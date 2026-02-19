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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Bell, Plus, Check, AlertTriangle, Info, XCircle, Zap, Filter } from "lucide-react";

type AlertSeverity = "info" | "warning" | "critical" | "emergency";

interface Alert {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  flight_id: string | null;
  is_active: boolean;
  is_acknowledged: boolean;
  acknowledged_at: string | null;
  created_at: string;
}

interface Flight {
  id: string;
  flight_number: string;
  airline: string;
}

const severityConfig: Record<AlertSeverity, { icon: React.FC<{className?: string}>, label: string, cls: string }> = {
  info: { icon: Info, label: "Info", cls: "severity-info text-[hsl(var(--severity-info))] border-[hsl(var(--severity-info)/0.3)]" },
  warning: { icon: AlertTriangle, label: "Warning", cls: "severity-warning text-[hsl(var(--severity-warning))] border-[hsl(var(--severity-warning)/0.3)]" },
  critical: { icon: XCircle, label: "Critical", cls: "severity-critical text-[hsl(var(--severity-critical))] border-[hsl(var(--severity-critical)/0.3)]" },
  emergency: { icon: Zap, label: "Emergency", cls: "severity-emergency text-[hsl(var(--severity-emergency))] border-[hsl(var(--severity-emergency)/0.3)]" },
};

export default function Alerts() {
  const { user, isATC } = useAuth();
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "acknowledged">("active");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", message: "", severity: "info" as AlertSeverity, flight_id: "" });
  const [saving, setSaving] = useState(false);

  const fetchAlerts = async () => {
    const { data } = await supabase.from("alerts").select("*").order("created_at", { ascending: false });
    setAlerts((data || []) as Alert[]);
    setLoading(false);
  };

  const fetchFlights = async () => {
    const { data } = await supabase.from("flights").select("id, flight_number, airline");
    setFlights(data || []);
  };

  useEffect(() => {
    fetchAlerts();
    fetchFlights();
    const channel = supabase.channel("alerts-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, fetchAlerts)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = alerts.filter(a => {
    const matchFilter = filter === "all" || (filter === "active" ? a.is_active && !a.is_acknowledged : a.is_acknowledged);
    const matchSeverity = severityFilter === "all" || a.severity === severityFilter;
    return matchFilter && matchSeverity;
  });

  const handleAcknowledge = async (alertId: string) => {
    const { error } = await supabase.from("alerts").update({
      is_acknowledged: true,
      acknowledged_by: user!.id,
      acknowledged_at: new Date().toISOString(),
      is_active: false,
    }).eq("id", alertId);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Alert Acknowledged" });
      await logActivity(user!.id, "Acknowledged alert", "alert", alertId);
      fetchAlerts();
    }
  };

  const handleCreate = async () => {
    if (!form.title || !form.message) {
      toast({ title: "Validation Error", description: "Title and message required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("alerts").insert([{
      title: form.title,
      message: form.message,
      severity: form.severity,
      flight_id: form.flight_id || null,
      created_by: user!.id,
    }]);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Alert Created", description: form.severity === "emergency" ? "EMERGENCY ALERT TRIGGERED!" : "Alert created." });
      await logActivity(user!.id, `Created ${form.severity} alert: ${form.title}`, "alert");
    }
    setSaving(false);
    setShowForm(false);
    setForm({ title: "", message: "", severity: "info", flight_id: "" });
    fetchAlerts();
  };

  const counts = { info: 0, warning: 0, critical: 0, emergency: 0, total: alerts.filter(a => !a.is_acknowledged).length };
  alerts.filter(a => !a.is_acknowledged).forEach(a => counts[a.severity]++);

  return (
    <AppLayout title="Alert System">
      <div className="space-y-4 animate-fade-in-up">
        {/* Active emergency banner */}
        {counts.emergency > 0 && (
          <div className="p-4 rounded-xl border-2 border-[hsl(var(--severity-emergency))] bg-[hsl(var(--severity-emergency)/0.1)] animate-pulse flex items-center gap-3">
            <Zap className="w-5 h-5 text-[hsl(var(--severity-emergency))] shrink-0" />
            <div>
              <p className="font-bold text-[hsl(var(--severity-emergency))]">EMERGENCY ALERT ACTIVE</p>
              <p className="text-sm text-muted-foreground">{counts.emergency} emergency alert(s) require immediate attention</p>
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-4 gap-3">
          {(["info","warning","critical","emergency"] as AlertSeverity[]).map(s => {
            const cfg = severityConfig[s];
            return (
              <div key={s} className={`glass-card rounded-xl p-4 border ${cfg.cls}`}>
                <div className="flex items-center gap-3">
                  <cfg.icon className="w-4 h-4" />
                  <div>
                    <p className="text-2xl font-bold">{counts[s]}</p>
                    <p className="text-xs text-muted-foreground">Active {cfg.label}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex rounded-lg bg-muted p-1">
            {(["active","all","acknowledged"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all capitalize ${filter === f ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                {f}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-36 bg-card border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="emergency">Emergency</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setShowForm(true)} className="ml-auto bg-primary text-primary-foreground gap-2">
            <Plus className="w-4 h-4" /> Create Alert
          </Button>
        </div>

        {/* Alerts list */}
        <div className="space-y-2">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading alerts...</div>
          ) : filtered.length === 0 ? (
            <div className="glass-card rounded-xl p-8 text-center">
              <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No alerts found</p>
            </div>
          ) : (
            filtered.map(a => {
              const cfg = severityConfig[a.severity];
              return (
                <div key={a.id} className={`glass-card rounded-xl p-4 border transition-all ${a.is_acknowledged ? "opacity-60" : ""} ${cfg.cls}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`mt-0.5 p-1.5 rounded-lg ${a.severity === "emergency" ? "bg-[hsl(var(--severity-emergency)/0.2)]" : "bg-muted"}`}>
                        <cfg.icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-foreground">{a.title}</span>
                          <span className={`text-xs px-2 py-0.5 rounded border font-semibold capitalize ${cfg.cls}`}>{a.severity}</span>
                          {a.is_acknowledged && (
                            <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">Acknowledged</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{a.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(a.created_at).toLocaleString()}
                          {a.acknowledged_at && ` · Acknowledged: ${new Date(a.acknowledged_at).toLocaleString()}`}
                        </p>
                      </div>
                    </div>
                    {!a.is_acknowledged && (
                      <button
                        onClick={() => handleAcknowledge(a.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[hsl(var(--status-departed)/0.3)] bg-[hsl(var(--status-departed)/0.1)] text-[hsl(var(--status-departed))] text-xs font-semibold hover:bg-[hsl(var(--status-departed)/0.2)] transition-colors shrink-0"
                      >
                        <Check className="w-3 h-3" /> Acknowledge
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Create Alert */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>Create Alert</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Severity</Label>
              <Select value={form.severity} onValueChange={v => setForm(p => ({ ...p, severity: v as AlertSeverity }))}>
                <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["info","warning","critical","emergency"] as AlertSeverity[]).map(s => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Title *</Label>
              <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Alert title..." className="bg-muted border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Message *</Label>
              <Textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} placeholder="Describe the situation..." className="bg-muted border-border resize-none h-20" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Related Flight (optional)</Label>
              <Select value={form.flight_id || "none"} onValueChange={v => setForm(p => ({ ...p, flight_id: v === "none" ? "" : v }))}>
                <SelectTrigger className="bg-muted border-border"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {flights.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.flight_number} — {f.airline}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving} className={form.severity === "emergency" ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"}>
              {saving ? "Creating..." : (form.severity === "emergency" ? "⚠️ Trigger Emergency Alert" : "Create Alert")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
