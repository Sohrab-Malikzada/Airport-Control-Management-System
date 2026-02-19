import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logActivity } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Edit, Trash2, Eye, Plane, Filter } from "lucide-react";

type FlightStatus = "scheduled" | "boarding" | "delayed" | "departed" | "landed" | "cancelled" | "emergency";

interface Runway { id: string; name: string; status: string; }
interface Flight {
  id: string;
  flight_number: string;
  airline: string;
  origin: string;
  destination: string;
  status: FlightStatus;
  scheduled_departure: string;
  scheduled_arrival: string;
  actual_departure: string | null;
  actual_arrival: string | null;
  runway_id: string | null;
  gate: string | null;
  aircraft_type: string;
  capacity: number;
  notes: string | null;
  created_at: string;
}

const statusBadge: Record<FlightStatus, string> = {
  scheduled: "bg-[hsl(var(--status-scheduled)/0.15)] text-[hsl(var(--status-scheduled))] border-[hsl(var(--status-scheduled)/0.3)]",
  boarding: "bg-[hsl(var(--status-boarding)/0.15)] text-[hsl(var(--status-boarding))] border-[hsl(var(--status-boarding)/0.3)]",
  delayed: "bg-[hsl(var(--status-delayed)/0.15)] text-[hsl(var(--status-delayed))] border-[hsl(var(--status-delayed)/0.3)]",
  departed: "bg-[hsl(var(--status-departed)/0.15)] text-[hsl(var(--status-departed))] border-[hsl(var(--status-departed)/0.3)]",
  landed: "bg-[hsl(var(--status-landed)/0.15)] text-[hsl(var(--status-landed))] border-[hsl(var(--status-landed)/0.3)]",
  cancelled: "bg-[hsl(var(--status-cancelled)/0.15)] text-[hsl(var(--status-cancelled))] border-[hsl(var(--status-cancelled)/0.3)]",
  emergency: "bg-[hsl(var(--status-emergency)/0.15)] text-[hsl(var(--status-emergency))] border-[hsl(var(--status-emergency)/0.3)] animate-pulse",
};

const defaultForm = {
  flight_number: "", airline: "", origin: "", destination: "",
  status: "scheduled" as FlightStatus, scheduled_departure: "", scheduled_arrival: "",
  runway_id: "", gate: "", aircraft_type: "Boeing 737", capacity: 180, notes: "",
};

export default function Flights() {
  const { user, canManageFlights } = useAuth();
  const { toast } = useToast();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [runways, setRunways] = useState<Runway[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState(defaultForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewFlight, setViewFlight] = useState<Flight | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchFlights = async () => {
    const { data } = await supabase.from("flights").select("*").order("scheduled_departure");
    setFlights((data || []) as Flight[]);
    setLoading(false);
  };

  const fetchRunways = async () => {
    const { data } = await supabase.from("runways").select("id, name, status");
    setRunways(data || []);
  };

  useEffect(() => {
    fetchFlights();
    fetchRunways();
    const channel = supabase.channel("flights-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "flights" }, fetchFlights)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = flights.filter(f => {
    const matchSearch = f.flight_number.toLowerCase().includes(search.toLowerCase()) ||
      f.airline.toLowerCase().includes(search.toLowerCase()) ||
      f.origin.toLowerCase().includes(search.toLowerCase()) ||
      f.destination.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || f.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const openAdd = () => {
    setForm(defaultForm);
    setEditId(null);
    setShowForm(true);
  };

  const openEdit = (f: Flight) => {
    setForm({
      flight_number: f.flight_number,
      airline: f.airline,
      origin: f.origin,
      destination: f.destination,
      status: f.status,
      scheduled_departure: f.scheduled_departure.slice(0, 16),
      scheduled_arrival: f.scheduled_arrival.slice(0, 16),
      runway_id: f.runway_id || "",
      gate: f.gate || "",
      aircraft_type: f.aircraft_type,
      capacity: f.capacity,
      notes: f.notes || "",
    });
    setEditId(f.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.flight_number || !form.airline || !form.origin || !form.destination ||
      !form.scheduled_departure || !form.scheduled_arrival) {
      toast({ title: "Validation Error", description: "Please fill all required fields.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      flight_number: form.flight_number.toUpperCase(),
      airline: form.airline,
      origin: form.origin.toUpperCase(),
      destination: form.destination.toUpperCase(),
      status: form.status,
      scheduled_departure: new Date(form.scheduled_departure).toISOString(),
      scheduled_arrival: new Date(form.scheduled_arrival).toISOString(),
      runway_id: form.runway_id || null,
      gate: form.gate || null,
      aircraft_type: form.aircraft_type,
      capacity: Number(form.capacity),
      notes: form.notes || null,
      created_by: user?.id,
    };

    if (editId) {
      const { error } = await supabase.from("flights").update(payload).eq("id", editId);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
      else {
        toast({ title: "Flight Updated", description: `${payload.flight_number} updated successfully.` });
        await logActivity(user!.id, `Updated flight ${payload.flight_number}`, "flight", editId);
      }
    } else {
      const { error } = await supabase.from("flights").insert([payload]);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
      else {
        toast({ title: "Flight Added", description: `${payload.flight_number} added successfully.` });
        await logActivity(user!.id, `Added flight ${payload.flight_number} (${payload.origin} → ${payload.destination})`, "flight");
      }
    }
    setSaving(false);
    setShowForm(false);
    fetchFlights();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const f = flights.find(f => f.id === deleteId);
    const { error } = await supabase.from("flights").delete().eq("id", deleteId);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    else {
      toast({ title: "Flight Deleted", description: `${f?.flight_number} removed.` });
      await logActivity(user!.id, `Deleted flight ${f?.flight_number}`, "flight", deleteId);
      fetchFlights();
    }
    setDeleteId(null);
  };

  const handleStatusChange = async (flightId: string, newStatus: FlightStatus) => {
    const f = flights.find(fl => fl.id === flightId);
    const { error } = await supabase.from("flights").update({ status: newStatus }).eq("id", flightId);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    else {
      toast({ title: "Status Updated", description: `${f?.flight_number} is now ${newStatus}.` });
      await logActivity(user!.id, `Changed ${f?.flight_number} status to ${newStatus}`, "flight", flightId);
      fetchFlights();
    }
  };

  const runwayName = (id: string | null) => runways.find(r => r.id === id)?.name || "—";

  return (
    <AppLayout title="Flight Management">
      <div className="space-y-4 animate-fade-in-up">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search flights, airlines, routes..."
              className="pl-9 bg-card border-border"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 bg-card border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="boarding">Boarding</SelectItem>
                <SelectItem value="delayed">Delayed</SelectItem>
                <SelectItem value="departed">Departed</SelectItem>
                <SelectItem value="landed">Landed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="emergency">Emergency</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {canManageFlights() && (
            <Button onClick={openAdd} className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
              <Plus className="w-4 h-4" /> Add Flight
            </Button>
          )}
        </div>

        {/* Table */}
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Flight</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Route</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Departure</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Runway</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Gate</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Loading flights...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12">
                      <Plane className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">No flights found</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map(f => (
                    <tr key={f.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-mono font-bold text-primary">{f.flight_number}</p>
                          <p className="text-xs text-muted-foreground">{f.airline}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-foreground font-medium">{f.origin} → {f.destination}</td>
                      <td className="px-4 py-3">
                        {canManageFlights() ? (
                          <Select value={f.status} onValueChange={(v) => handleStatusChange(f.id, v as FlightStatus)}>
                            <SelectTrigger className={`w-32 h-7 text-xs font-semibold border capitalize ${statusBadge[f.status]} bg-transparent`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(["scheduled","boarding","delayed","departed","landed","cancelled","emergency"] as FlightStatus[]).map(s => (
                                <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className={`text-xs font-semibold px-2 py-1 rounded border capitalize ${statusBadge[f.status]}`}>
                            {f.status}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                        {new Date(f.scheduled_departure).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{runwayName(f.runway_id)}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{f.gate || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setViewFlight(f)} className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {canManageFlights() && (
                            <>
                              <button onClick={() => openEdit(f)} className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setDeleteId(f.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-border/50 text-xs text-muted-foreground">
            Showing {filtered.length} of {flights.length} flights
          </div>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Flight" : "Add New Flight"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Flight Number *</Label>
              <Input value={form.flight_number} onChange={e => setForm(p => ({ ...p, flight_number: e.target.value }))} placeholder="AA1234" className="bg-muted border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Airline *</Label>
              <Input value={form.airline} onChange={e => setForm(p => ({ ...p, airline: e.target.value }))} placeholder="American Airlines" className="bg-muted border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Origin *</Label>
              <Input value={form.origin} onChange={e => setForm(p => ({ ...p, origin: e.target.value }))} placeholder="JFK" className="bg-muted border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Destination *</Label>
              <Input value={form.destination} onChange={e => setForm(p => ({ ...p, destination: e.target.value }))} placeholder="LAX" className="bg-muted border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Scheduled Departure *</Label>
              <Input type="datetime-local" value={form.scheduled_departure} onChange={e => setForm(p => ({ ...p, scheduled_departure: e.target.value }))} className="bg-muted border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Scheduled Arrival *</Label>
              <Input type="datetime-local" value={form.scheduled_arrival} onChange={e => setForm(p => ({ ...p, scheduled_arrival: e.target.value }))} className="bg-muted border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v as FlightStatus }))}>
                <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["scheduled","boarding","delayed","departed","landed","cancelled","emergency"].map(s => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Runway Assignment</Label>
              <Select value={form.runway_id || "none"} onValueChange={v => setForm(p => ({ ...p, runway_id: v === "none" ? "" : v }))}>
                <SelectTrigger className="bg-muted border-border"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {runways.filter(r => r.status === "available" || r.id === form.runway_id).map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Gate</Label>
              <Input value={form.gate} onChange={e => setForm(p => ({ ...p, gate: e.target.value }))} placeholder="A12" className="bg-muted border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Aircraft Type</Label>
              <Input value={form.aircraft_type} onChange={e => setForm(p => ({ ...p, aircraft_type: e.target.value }))} placeholder="Boeing 737" className="bg-muted border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Capacity</Label>
              <Input type="number" value={form.capacity} onChange={e => setForm(p => ({ ...p, capacity: Number(e.target.value) }))} className="bg-muted border-border" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Notes</Label>
              <Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional notes..." className="bg-muted border-border" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground">
              {saving ? "Saving..." : (editId ? "Update Flight" : "Add Flight")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      {viewFlight && (
        <Dialog open={!!viewFlight} onOpenChange={() => setViewFlight(null)}>
          <DialogContent className="bg-card border-border max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <span className="font-mono text-primary text-xl">{viewFlight.flight_number}</span>
                <span className={`text-xs font-semibold px-2 py-1 rounded border capitalize ${statusBadge[viewFlight.status]}`}>
                  {viewFlight.status}
                </span>
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["Airline", viewFlight.airline],
                ["Route", `${viewFlight.origin} → ${viewFlight.destination}`],
                ["Aircraft", viewFlight.aircraft_type],
                ["Capacity", viewFlight.capacity.toString()],
                ["Gate", viewFlight.gate || "—"],
                ["Runway", runwayName(viewFlight.runway_id)],
                ["Departure", new Date(viewFlight.scheduled_departure).toLocaleString()],
                ["Arrival", new Date(viewFlight.scheduled_arrival).toLocaleString()],
              ].map(([l, v]) => (
                <div key={l} className="bg-muted/50 rounded-lg p-2.5">
                  <p className="text-xs text-muted-foreground">{l}</p>
                  <p className="font-medium text-foreground mt-0.5">{v}</p>
                </div>
              ))}
              {viewFlight.notes && (
                <div className="col-span-2 bg-muted/50 rounded-lg p-2.5">
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="font-medium text-foreground mt-0.5">{viewFlight.notes}</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Flight</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the flight and all associated passengers. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
