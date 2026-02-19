import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logActivity } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Edit, Trash2, Users, CheckCircle, XCircle } from "lucide-react";

type BoardingStatus = "checked_in" | "boarding" | "boarded" | "no_show";

interface Flight {
  id: string;
  flight_number: string;
  airline: string;
  origin: string;
  destination: string;
  status: string;
}

interface Passenger {
  id: string;
  flight_id: string;
  first_name: string;
  last_name: string;
  passport_number: string;
  seat_number: string | null;
  ticket_id: string;
  boarding_status: BoardingStatus;
  nationality: string;
  created_at: string;
}

const boardingBadge: Record<BoardingStatus, string> = {
  checked_in: "bg-[hsl(var(--status-scheduled)/0.15)] text-[hsl(var(--status-scheduled))] border-[hsl(var(--status-scheduled)/0.3)]",
  boarding: "bg-[hsl(var(--status-boarding)/0.15)] text-[hsl(var(--status-boarding))] border-[hsl(var(--status-boarding)/0.3)]",
  boarded: "bg-[hsl(var(--status-departed)/0.15)] text-[hsl(var(--status-departed))] border-[hsl(var(--status-departed)/0.3)]",
  no_show: "bg-[hsl(var(--status-cancelled)/0.15)] text-[hsl(var(--status-cancelled))] border-[hsl(var(--status-cancelled)/0.3)]",
};

const defaultForm = {
  flight_id: "", first_name: "", last_name: "", passport_number: "",
  seat_number: "", nationality: "", boarding_status: "checked_in" as BoardingStatus,
};

export default function Passengers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [flightFilter, setFlightFilter] = useState("all");
  const [ticketSearch, setTicketSearch] = useState("");
  const [foundPassenger, setFoundPassenger] = useState<Passenger | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchPassengers = async () => {
    const { data } = await supabase.from("passengers").select("*").order("created_at", { ascending: false });
    setPassengers((data || []) as Passenger[]);
    setLoading(false);
  };

  const fetchFlights = async () => {
    const { data } = await supabase.from("flights").select("id, flight_number, airline, origin, destination, status")
      .not("status", "in", '("cancelled","landed")').order("scheduled_departure");
    setFlights(data || []);
  };

  useEffect(() => {
    fetchPassengers();
    fetchFlights();
    const channel = supabase.channel("passengers-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "passengers" }, fetchPassengers)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = passengers.filter(p => {
    const matchSearch = `${p.first_name} ${p.last_name} ${p.passport_number} ${p.ticket_id}`.toLowerCase().includes(search.toLowerCase());
    const matchFlight = flightFilter === "all" || p.flight_id === flightFilter;
    return matchSearch && matchFlight;
  });

  const openAdd = () => { setForm(defaultForm); setEditId(null); setShowForm(true); };
  const openEdit = (p: Passenger) => {
    setForm({ flight_id: p.flight_id, first_name: p.first_name, last_name: p.last_name, passport_number: p.passport_number, seat_number: p.seat_number || "", nationality: p.nationality, boarding_status: p.boarding_status });
    setEditId(p.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.flight_id || !form.first_name || !form.last_name || !form.passport_number) {
      toast({ title: "Validation Error", description: "Please fill all required fields.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      flight_id: form.flight_id,
      first_name: form.first_name,
      last_name: form.last_name,
      passport_number: form.passport_number,
      seat_number: form.seat_number || null,
      nationality: form.nationality || "Unknown",
      boarding_status: form.boarding_status,
    };
    if (editId) {
      const { error } = await supabase.from("passengers").update(payload).eq("id", editId);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else {
        toast({ title: "Passenger Updated" });
        await logActivity(user!.id, `Updated passenger ${form.first_name} ${form.last_name}`, "passenger", editId);
      }
    } else {
      const { error } = await supabase.from("passengers").insert([payload]);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else {
        toast({ title: "Passenger Added", description: `${form.first_name} ${form.last_name} added.` });
        await logActivity(user!.id, `Added passenger ${form.first_name} ${form.last_name}`, "passenger");
      }
    }
    setSaving(false);
    setShowForm(false);
    fetchPassengers();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const p = passengers.find(p => p.id === deleteId);
    const { error } = await supabase.from("passengers").delete().eq("id", deleteId);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Passenger Removed", description: `${p?.first_name} ${p?.last_name} removed.` });
      await logActivity(user!.id, `Removed passenger ${p?.first_name} ${p?.last_name}`, "passenger", deleteId);
      fetchPassengers();
    }
    setDeleteId(null);
  };

  const handleBoardingUpdate = async (passengerId: string, newStatus: BoardingStatus) => {
    const p = passengers.find(p => p.id === passengerId);
    const { error } = await supabase.from("passengers").update({ boarding_status: newStatus }).eq("id", passengerId);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Boarding Updated", description: `${p?.first_name} ${p?.last_name} is now ${newStatus.replace("_", " ")}.` });
      await logActivity(user!.id, `Updated boarding status: ${p?.first_name} ${p?.last_name} → ${newStatus}`, "passenger", passengerId);
      fetchPassengers();
    }
  };

  const validateTicket = async () => {
    if (!ticketSearch.trim()) return;
    const { data } = await supabase.from("passengers").select("*").eq("ticket_id", ticketSearch.trim().toUpperCase()).single();
    setFoundPassenger((data as Passenger | null));
    if (!data) toast({ title: "Not Found", description: "No passenger found with that ticket ID.", variant: "destructive" });
  };

  const flightInfo = (id: string) => {
    const f = flights.find(f => f.id === id);
    return f ? `${f.flight_number} (${f.origin}→${f.destination})` : "—";
  };

  const counts = { checked_in: 0, boarding: 0, boarded: 0, no_show: 0 };
  passengers.forEach(p => counts[p.boarding_status]++);

  return (
    <AppLayout title="Passenger Management">
      <div className="space-y-4 animate-fade-in-up">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { k: "checked_in", l: "Checked In", icon: Users },
            { k: "boarding", l: "Boarding", icon: Users },
            { k: "boarded", l: "Boarded", icon: CheckCircle },
            { k: "no_show", l: "No Show", icon: XCircle },
          ].map(({ k, l, icon: Icon }) => (
            <div key={k} className="glass-card rounded-xl p-4 border border-border">
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold text-foreground">{counts[k as BoardingStatus]}</p>
                  <p className="text-xs text-muted-foreground">{l}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Ticket Validator */}
        <div className="glass-card rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Ticket ID Validator</h3>
          <div className="flex gap-2">
            <Input
              value={ticketSearch}
              onChange={e => setTicketSearch(e.target.value.toUpperCase())}
              placeholder="Enter Ticket ID (e.g. TKT-AB123456)"
              className="bg-muted border-border font-mono"
              onKeyDown={e => e.key === "Enter" && validateTicket()}
            />
            <Button onClick={validateTicket} className="bg-primary text-primary-foreground">Validate</Button>
          </div>
          {foundPassenger && (
            <div className="mt-3 p-3 rounded-lg bg-[hsl(var(--status-departed)/0.1)] border border-[hsl(var(--status-departed)/0.3)]">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-[hsl(var(--status-departed))]" />
                <span className="text-sm font-semibold text-[hsl(var(--status-departed))]">Valid Ticket</span>
              </div>
              <p className="text-sm font-medium text-foreground">{foundPassenger.first_name} {foundPassenger.last_name}</p>
              <p className="text-xs text-muted-foreground">Seat: {foundPassenger.seat_number || "Not assigned"} · Status: {foundPassenger.boarding_status.replace("_", " ")} · Flight: {flightInfo(foundPassenger.flight_id)}</p>
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search passengers..." className="pl-9 bg-card border-border" />
          </div>
          <Select value={flightFilter} onValueChange={setFlightFilter}>
            <SelectTrigger className="w-48 bg-card border-border"><SelectValue placeholder="All Flights" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Flights</SelectItem>
              {flights.map(f => (
                <SelectItem key={f.id} value={f.id}>{f.flight_number}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openAdd} className="bg-primary text-primary-foreground gap-2">
            <Plus className="w-4 h-4" /> Add Passenger
          </Button>
        </div>

        {/* Table */}
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Passenger</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ticket ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Flight</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Seat</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Boarding</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12">
                      <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">No passengers found</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map(p => (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground">{p.first_name} {p.last_name}</p>
                          <p className="text-xs text-muted-foreground">{p.nationality} · {p.passport_number}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-primary">{p.ticket_id}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{flightInfo(p.flight_id)}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{p.seat_number || "—"}</td>
                      <td className="px-4 py-3">
                        <Select value={p.boarding_status} onValueChange={(v) => handleBoardingUpdate(p.id, v as BoardingStatus)}>
                          <SelectTrigger className={`w-32 h-7 text-xs font-semibold border bg-transparent capitalize ${boardingBadge[p.boarding_status]}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(["checked_in","boarding","boarded","no_show"] as BoardingStatus[]).map(s => (
                              <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(p)} className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeleteId(p.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-border/50 text-xs text-muted-foreground">
            {filtered.length} of {passengers.length} passengers
          </div>
        </div>
      </div>

      {/* Add/Edit */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Passenger" : "Add Passenger"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">First Name *</Label>
              <Input value={form.first_name} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} className="bg-muted border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Last Name *</Label>
              <Input value={form.last_name} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} className="bg-muted border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Passport Number *</Label>
              <Input value={form.passport_number} onChange={e => setForm(p => ({ ...p, passport_number: e.target.value }))} className="bg-muted border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nationality</Label>
              <Input value={form.nationality} onChange={e => setForm(p => ({ ...p, nationality: e.target.value }))} placeholder="American" className="bg-muted border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Seat Number</Label>
              <Input value={form.seat_number} onChange={e => setForm(p => ({ ...p, seat_number: e.target.value }))} placeholder="12A" className="bg-muted border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Boarding Status</Label>
              <Select value={form.boarding_status} onValueChange={v => setForm(p => ({ ...p, boarding_status: v as BoardingStatus }))}>
                <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["checked_in","boarding","boarded","no_show"].map(s => (
                    <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Flight *</Label>
              <Select value={form.flight_id} onValueChange={v => setForm(p => ({ ...p, flight_id: v }))}>
                <SelectTrigger className="bg-muted border-border"><SelectValue placeholder="Select flight..." /></SelectTrigger>
                <SelectContent>
                  {flights.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.flight_number} — {f.airline} ({f.origin}→{f.destination})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground">
              {saving ? "Saving..." : (editId ? "Update" : "Add Passenger")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Passenger</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the passenger record. Continue?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
