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
import { Plus, Edit, Trash2, Wind, CheckCircle, AlertTriangle, XCircle, Wrench } from "lucide-react";

type RunwayStatus = "available" | "occupied" | "maintenance" | "closed";

interface Runway {
  id: string;
  name: string;
  length_meters: number;
  status: RunwayStatus;
  surface_type: string;
  notes: string | null;
  created_at: string;
}

interface AssignedFlight {
  id: string;
  flight_number: string;
  airline: string;
  status: string;
}

const statusConfig: Record<RunwayStatus, { icon: React.FC<{className?: string}>, label: string, color: string, bg: string, border: string }> = {
  available: { icon: CheckCircle, label: "Available", color: "runway-available text-[hsl(var(--runway-available))]", bg: "bg-[hsl(var(--runway-available)/0.1)]", border: "border-[hsl(var(--runway-available)/0.3)]" },
  occupied: { icon: Wind, label: "Occupied", color: "runway-occupied text-[hsl(var(--runway-occupied))]", bg: "bg-[hsl(var(--runway-occupied)/0.1)]", border: "border-[hsl(var(--runway-occupied)/0.3)]" },
  maintenance: { icon: Wrench, label: "Maintenance", color: "runway-maintenance text-[hsl(var(--runway-maintenance))]", bg: "bg-[hsl(var(--runway-maintenance)/0.1)]", border: "border-[hsl(var(--runway-maintenance)/0.3)]" },
  closed: { icon: XCircle, label: "Closed", color: "runway-closed text-[hsl(var(--runway-closed))]", bg: "bg-[hsl(var(--runway-closed)/0.1)]", border: "border-[hsl(var(--runway-closed)/0.3)]" },
};

const defaultForm = { name: "", length_meters: 3000, status: "available" as RunwayStatus, surface_type: "asphalt", notes: "" };

export default function Runways() {
  const { user, isATC } = useAuth();
  const { toast } = useToast();
  const [runways, setRunways] = useState<Runway[]>([]);
  const [assignedFlights, setAssignedFlights] = useState<Record<string, AssignedFlight>>({});
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(defaultForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchRunways = async () => {
    const { data } = await supabase.from("runways").select("*").order("name");
    setRunways((data || []) as Runway[]);
    setLoading(false);
  };

  const fetchAssignedFlights = async () => {
    const { data } = await supabase
      .from("flights")
      .select("id, flight_number, airline, status, runway_id")
      .not("runway_id", "is", null)
      .not("status", "in", '("landed","cancelled","departed")');
    const map: Record<string, AssignedFlight> = {};
    (data || []).forEach((f: { id: string; flight_number: string; airline: string; status: string; runway_id: string }) => {
      if (f.runway_id) map[f.runway_id] = { id: f.id, flight_number: f.flight_number, airline: f.airline, status: f.status };
    });
    setAssignedFlights(map);
  };

  useEffect(() => {
    fetchRunways();
    fetchAssignedFlights();
    const channel = supabase.channel("runways-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "runways" }, fetchRunways)
      .on("postgres_changes", { event: "*", schema: "public", table: "flights" }, fetchAssignedFlights)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const openAdd = () => { setForm(defaultForm); setEditId(null); setShowForm(true); };
  const openEdit = (r: Runway) => {
    setForm({ name: r.name, length_meters: r.length_meters, status: r.status, surface_type: r.surface_type, notes: r.notes || "" });
    setEditId(r.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name) { toast({ title: "Validation Error", description: "Name is required.", variant: "destructive" }); return; }
    setSaving(true);
    const payload = { name: form.name, length_meters: Number(form.length_meters), status: form.status, surface_type: form.surface_type, notes: form.notes || null };
    if (editId) {
      const { error } = await supabase.from("runways").update(payload).eq("id", editId);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else {
        toast({ title: "Runway Updated" });
        await logActivity(user!.id, `Updated runway ${payload.name}`, "runway", editId);
      }
    } else {
      const { error } = await supabase.from("runways").insert([payload]);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else {
        toast({ title: "Runway Created", description: `${payload.name} added.` });
        await logActivity(user!.id, `Created runway ${payload.name}`, "runway");
      }
    }
    setSaving(false);
    setShowForm(false);
    fetchRunways();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const r = runways.find(r => r.id === deleteId);
    const { error } = await supabase.from("runways").delete().eq("id", deleteId);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Runway Deleted", description: `${r?.name} removed.` });
      await logActivity(user!.id, `Deleted runway ${r?.name}`, "runway", deleteId);
      fetchRunways();
    }
    setDeleteId(null);
  };

  const handleStatusChange = async (runwayId: string, newStatus: RunwayStatus) => {
    const r = runways.find(r => r.id === runwayId);
    if (newStatus === "available" && assignedFlights[runwayId]) {
      toast({ title: "Cannot Set Available", description: "This runway has an active flight assignment.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("runways").update({ status: newStatus }).eq("id", runwayId);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Status Updated", description: `${r?.name} is now ${newStatus}.` });
      await logActivity(user!.id, `Changed ${r?.name} status to ${newStatus}`, "runway", runwayId);
    }
  };

  const counts = { available: 0, occupied: 0, maintenance: 0, closed: 0 };
  runways.forEach(r => counts[r.status]++);

  return (
    <AppLayout title="Runway Management">
      <div className="space-y-4 animate-fade-in-up">
        {/* Summary */}
        <div className="grid grid-cols-4 gap-3">
          {(Object.keys(statusConfig) as RunwayStatus[]).map(s => {
            const cfg = statusConfig[s];
            return (
              <div key={s} className={`glass-card rounded-xl p-4 border ${cfg.border}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${cfg.bg} border ${cfg.border}`}>
                    <cfg.icon className={`w-4 h-4 ${cfg.color}`} />
                  </div>
                  <div>
                    <p className={`text-2xl font-bold ${cfg.color}`}>{counts[s]}</p>
                    <p className="text-xs text-muted-foreground">{cfg.label}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">All Runways ({runways.length})</h2>
          {isATC() && (
            <Button onClick={openAdd} className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
              <Plus className="w-4 h-4" /> Add Runway
            </Button>
          )}
        </div>

        {/* Runway Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {loading ? (
            <p className="text-muted-foreground col-span-3 py-8 text-center">Loading runways...</p>
          ) : runways.map(r => {
            const cfg = statusConfig[r.status];
            const assigned = assignedFlights[r.id];
            return (
              <div key={r.id} className={`glass-card rounded-xl p-4 border ${cfg.border} relative overflow-hidden`}>
                {/* Status stripe */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${cfg.bg} border-r ${cfg.border}`} />

                <div className="pl-3">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-foreground text-lg">{r.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{r.length_meters.toLocaleString()}m · {r.surface_type}</p>
                    </div>
                    {isATC() && (
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(r)} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteId(r.id)} className="p-1.5 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Status */}
                  {isATC() ? (
                    <Select value={r.status} onValueChange={v => handleStatusChange(r.id, v as RunwayStatus)}>
                      <SelectTrigger className={`w-full h-8 text-xs font-semibold border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                        <div className="flex items-center gap-2">
                          <cfg.icon className="w-3.5 h-3.5" />
                          <SelectValue />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {(["available","occupied","maintenance","closed"] as RunwayStatus[]).map(s => (
                          <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                      <cfg.icon className="w-3.5 h-3.5" />
                      <span className="capitalize">{r.status}</span>
                    </div>
                  )}

                  {/* Assigned flight */}
                  {assigned && (
                    <div className="mt-2 p-2 rounded-lg bg-muted/50 border border-border/50">
                      <p className="text-xs text-muted-foreground">Assigned Flight</p>
                      <p className="text-sm font-mono font-bold text-primary">{assigned.flight_number}</p>
                      <p className="text-xs text-muted-foreground">{assigned.airline} · <span className="capitalize">{assigned.status}</span></p>
                    </div>
                  )}

                  {r.notes && (
                    <p className="text-xs text-muted-foreground mt-2 italic">{r.notes}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add/Edit */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Runway" : "Add Runway"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Runway Name *</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Runway 01L" className="bg-muted border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Length (meters)</Label>
              <Input type="number" value={form.length_meters} onChange={e => setForm(p => ({ ...p, length_meters: Number(e.target.value) }))} className="bg-muted border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Surface Type</Label>
              <Select value={form.surface_type} onValueChange={v => setForm(p => ({ ...p, surface_type: v }))}>
                <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="asphalt">Asphalt</SelectItem>
                  <SelectItem value="concrete">Concrete</SelectItem>
                  <SelectItem value="gravel">Gravel</SelectItem>
                  <SelectItem value="grass">Grass</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v as RunwayStatus }))}>
                <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["available","occupied","maintenance","closed"].map(s => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional notes..." className="bg-muted border-border" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground">
              {saving ? "Saving..." : (editId ? "Update" : "Create Runway")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Runway</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the runway. Are you sure?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
