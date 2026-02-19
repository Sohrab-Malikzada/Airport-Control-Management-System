import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logActivity } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Radio, PlaneLanding, PlaneTakeoff, Clock, XCircle, AlertTriangle, CheckCircle, Plane } from "lucide-react";

type FlightStatus = "scheduled" | "boarding" | "delayed" | "departed" | "landed" | "cancelled" | "emergency";

interface Flight {
  id: string;
  flight_number: string;
  airline: string;
  origin: string;
  destination: string;
  status: FlightStatus;
  scheduled_departure: string;
  scheduled_arrival: string;
  runway_id: string | null;
  gate: string | null;
  notes: string | null;
}

interface Runway {
  id: string;
  name: string;
  status: string;
}

const statusBadge: Record<string, string> = {
  scheduled: "bg-[hsl(var(--status-scheduled)/0.15)] text-[hsl(var(--status-scheduled))] border-[hsl(var(--status-scheduled)/0.3)]",
  boarding: "bg-[hsl(var(--status-boarding)/0.15)] text-[hsl(var(--status-boarding))] border-[hsl(var(--status-boarding)/0.3)]",
  delayed: "bg-[hsl(var(--status-delayed)/0.15)] text-[hsl(var(--status-delayed))] border-[hsl(var(--status-delayed)/0.3)]",
  departed: "bg-[hsl(var(--status-departed)/0.15)] text-[hsl(var(--status-departed))] border-[hsl(var(--status-departed)/0.3)]",
  landed: "bg-[hsl(var(--status-landed)/0.15)] text-[hsl(var(--status-landed))] border-[hsl(var(--status-landed)/0.3)]",
  cancelled: "bg-[hsl(var(--status-cancelled)/0.15)] text-[hsl(var(--status-cancelled))] border-[hsl(var(--status-cancelled)/0.3)]",
  emergency: "bg-[hsl(var(--status-emergency)/0.15)] text-[hsl(var(--status-emergency))] border-[hsl(var(--status-emergency)/0.3)] animate-pulse",
};

interface PendingAction {
  flightId: string;
  flightNumber: string;
  action: "landing" | "takeoff" | "delay" | "cancel" | "emergency";
  newStatus: FlightStatus;
  title: string;
  description: string;
}

export default function ATCPanel() {
  const { user, isATC } = useAuth();
  const { toast } = useToast();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [runways, setRunways] = useState<Runway[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [emergencyNote, setEmergencyNote] = useState("");
  const [emergencyFlightId, setEmergencyFlightId] = useState<string | null>(null);
  const [delayMinutes, setDelayMinutes] = useState(30);
  const [delayReason, setDelayReason] = useState("");
  const [showDelay, setShowDelay] = useState<Flight | null>(null);

  const fetchData = async () => {
    const [fRes, rRes] = await Promise.all([
      supabase.from("flights").select("*").not("status", "in", '("landed","cancelled","departed")').order("scheduled_departure"),
      supabase.from("runways").select("id, name, status"),
    ]);
    setFlights((fRes.data || []) as Flight[]);
    setRunways(rRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const channel = supabase.channel("atc-panel")
      .on("postgres_changes", { event: "*", schema: "public", table: "flights" }, fetchData)
      .on("postgres_changes", { event: "*", schema: "public", table: "runways" }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const executeAction = async () => {
    if (!pendingAction) return;
    const { flightId, flightNumber, action, newStatus, title } = pendingAction;

    let updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === "departed") updates.actual_departure = new Date().toISOString();
    if (newStatus === "landed") updates.actual_arrival = new Date().toISOString();

    // Release runway on landing/cancel
    if (["landed", "cancelled", "departed"].includes(newStatus)) {
      const f = flights.find(fl => fl.id === flightId);
      if (f?.runway_id) {
        await supabase.from("runways").update({ status: "available" }).eq("id", f.runway_id);
        updates.runway_id = null;
      }
    }

    const { error } = await supabase.from("flights").update(updates).eq("id", flightId);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    else {
      toast({ title, description: `${flightNumber} status updated.` });
      await logActivity(user!.id, `ATC: ${title} for ${flightNumber}`, "flight", flightId, { action });

      // Create alert for significant events
      if (["emergency", "cancelled"].includes(newStatus)) {
        await supabase.from("alerts").insert([{
          title: newStatus === "emergency" ? `EMERGENCY: ${flightNumber}` : `Flight Cancelled: ${flightNumber}`,
          message: emergencyNote || `${flightNumber} status changed to ${newStatus}`,
          severity: newStatus === "emergency" ? "emergency" : "critical",
          flight_id: flightId,
          created_by: user!.id,
        }]);
      }
    }
    setPendingAction(null);
    setEmergencyNote("");
    fetchData();
  };

  const confirmAction = (flight: Flight, action: "landing" | "takeoff" | "delay" | "cancel" | "emergency") => {
    const statusMap: Record<string, FlightStatus> = {
      landing: "landed", takeoff: "departed", delay: "delayed", cancel: "cancelled", emergency: "emergency",
    };
    const titleMap: Record<string, string> = {
      landing: "Approve Landing", takeoff: "Approve Takeoff", delay: "Delay Flight",
      cancel: "Cancel Flight", emergency: "Activate Emergency",
    };
    const descMap: Record<string, string> = {
      landing: `Approve landing clearance for ${flight.flight_number}?`,
      takeoff: `Approve takeoff clearance for ${flight.flight_number}?`,
      delay: `Mark ${flight.flight_number} as delayed?`,
      cancel: `Cancel flight ${flight.flight_number}? This will release the runway.`,
      emergency: `Declare EMERGENCY for ${flight.flight_number}? This will trigger alerts.`,
    };
    if (action === "delay") { setShowDelay(flight); return; }
    setPendingAction({ flightId: flight.id, flightNumber: flight.flight_number, action, newStatus: statusMap[action] as FlightStatus, title: titleMap[action], description: descMap[action] });
    if (action === "emergency") setEmergencyFlightId(flight.id);
  };

  const handleDelay = async () => {
    if (!showDelay) return;
    const f = showDelay;
    const newDep = new Date(new Date(f.scheduled_departure).getTime() + delayMinutes * 60000);
    const newArr = new Date(new Date(f.scheduled_arrival).getTime() + delayMinutes * 60000);
    const { error } = await supabase.from("flights").update({
      status: "delayed",
      scheduled_departure: newDep.toISOString(),
      scheduled_arrival: newArr.toISOString(),
      notes: delayReason || f.notes,
    }).eq("id", f.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Flight Delayed", description: `${f.flight_number} delayed by ${delayMinutes} minutes.` });
      await logActivity(user!.id, `Delayed ${f.flight_number} by ${delayMinutes} min: ${delayReason}`, "flight", f.id);
      await supabase.from("alerts").insert([{
        title: `Flight Delayed: ${f.flight_number}`,
        message: `${f.flight_number} delayed by ${delayMinutes} minutes. Reason: ${delayReason || "Not specified"}`,
        severity: "warning",
        flight_id: f.id,
        created_by: user!.id,
      }]);
    }
    setShowDelay(null);
    setDelayReason("");
    setDelayMinutes(30);
    fetchData();
  };

  const runwayName = (id: string | null) => runways.find(r => r.id === id)?.name || "—";

  const atcActions = [
    { action: "landing" as const, icon: PlaneLanding, label: "Approve Landing", color: "bg-[hsl(var(--status-landed)/0.1)] text-[hsl(var(--status-landed))] border-[hsl(var(--status-landed)/0.3)] hover:bg-[hsl(var(--status-landed)/0.2)]", validStatuses: ["boarding", "scheduled"] },
    { action: "takeoff" as const, icon: PlaneTakeoff, label: "Approve Takeoff", color: "bg-[hsl(var(--status-departed)/0.1)] text-[hsl(var(--status-departed))] border-[hsl(var(--status-departed)/0.3)] hover:bg-[hsl(var(--status-departed)/0.2)]", validStatuses: ["boarding", "scheduled"] },
    { action: "delay" as const, icon: Clock, label: "Delay", color: "bg-[hsl(var(--status-delayed)/0.1)] text-[hsl(var(--status-delayed))] border-[hsl(var(--status-delayed)/0.3)] hover:bg-[hsl(var(--status-delayed)/0.2)]", validStatuses: ["scheduled", "boarding"] },
    { action: "cancel" as const, icon: XCircle, label: "Cancel", color: "bg-[hsl(var(--status-cancelled)/0.1)] text-[hsl(var(--status-cancelled))] border-[hsl(var(--status-cancelled)/0.3)] hover:bg-[hsl(var(--status-cancelled)/0.2)]", validStatuses: ["scheduled", "boarding", "delayed"] },
    { action: "emergency" as const, icon: AlertTriangle, label: "Emergency", color: "bg-[hsl(var(--status-emergency)/0.1)] text-[hsl(var(--status-emergency))] border-[hsl(var(--status-emergency)/0.3)] hover:bg-[hsl(var(--status-emergency)/0.2)]", validStatuses: ["scheduled", "boarding", "delayed", "landed"] },
  ];

  return (
    <AppLayout title="ATC Panel">
      <div className="space-y-4 animate-fade-in-up">
        {!isATC() && (
          <div className="glass-card rounded-xl p-4 border border-[hsl(var(--severity-warning)/0.3)] severity-warning">
            <p className="text-sm font-medium text-[hsl(var(--severity-warning))] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Read-only access. Only ATC and Admin can execute control actions.
            </p>
          </div>
        )}

        {/* Runway Status Overview */}
        <div className="glass-card rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Radio className="w-4 h-4 text-primary" />
            Runway Status — Live
          </h3>
          <div className="flex flex-wrap gap-2">
            {runways.map(r => (
              <div key={r.id} className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                r.status === "available" ? "bg-[hsl(var(--runway-available)/0.1)] border-[hsl(var(--runway-available)/0.3)] text-[hsl(var(--runway-available))]" :
                r.status === "occupied" ? "bg-[hsl(var(--runway-occupied)/0.1)] border-[hsl(var(--runway-occupied)/0.3)] text-[hsl(var(--runway-occupied))]" :
                r.status === "maintenance" ? "bg-[hsl(var(--runway-maintenance)/0.1)] border-[hsl(var(--runway-maintenance)/0.3)] text-[hsl(var(--runway-maintenance))]" :
                "bg-[hsl(var(--runway-closed)/0.1)] border-[hsl(var(--runway-closed)/0.3)] text-[hsl(var(--runway-closed))]"
              }`}>
                {r.name} — {r.status}
              </div>
            ))}
          </div>
        </div>

        {/* Flights Control */}
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Active Flights Control</h3>
            <span className="text-xs text-muted-foreground">{flights.length} active flights</span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : flights.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle className="w-8 h-8 text-[hsl(var(--status-departed))] mx-auto mb-2" />
              <p className="text-muted-foreground">No active flights requiring control</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {flights.map(f => (
                <div key={f.id} className="p-4 hover:bg-muted/20 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                    {/* Flight info */}
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <Plane className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-primary">{f.flight_number}</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded border capitalize ${statusBadge[f.status]}`}>
                            {f.status}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{f.airline}</p>
                      </div>
                      <div className="hidden md:block">
                        <p className="text-sm font-medium text-foreground">{f.origin} → {f.destination}</p>
                        <p className="text-xs text-muted-foreground">
                          Dep: {new Date(f.scheduled_departure).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} · Gate: {f.gate || "—"} · {runwayName(f.runway_id)}
                        </p>
                      </div>
                    </div>

                    {/* Action buttons */}
                    {isATC() && (
                      <div className="flex flex-wrap gap-1.5">
                        {atcActions.map(a => (
                          <button
                            key={a.action}
                            onClick={() => confirmAction(f, a.action)}
                            disabled={!a.validStatuses.includes(f.status)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed ${a.color}`}
                          >
                            <a.icon className="w-3 h-3" />
                            {a.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Confirm Action */}
      <AlertDialog open={!!pendingAction} onOpenChange={() => setPendingAction(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className={pendingAction?.action === "emergency" ? "text-[hsl(var(--status-emergency))]" : ""}>
              {pendingAction?.action === "emergency" && "⚠️ "}{pendingAction?.title}
            </AlertDialogTitle>
            <AlertDialogDescription>{pendingAction?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          {pendingAction?.action === "emergency" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Emergency Notes</Label>
              <Textarea
                value={emergencyNote}
                onChange={e => setEmergencyNote(e.target.value)}
                placeholder="Describe the emergency situation..."
                className="bg-muted border-border resize-none h-20"
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeAction}
              className={pendingAction?.action === "emergency" || pendingAction?.action === "cancel"
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
              }
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delay dialog */}
      <Dialog open={!!showDelay} onOpenChange={() => setShowDelay(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Delay Flight {showDelay?.flight_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Delay Duration (minutes)</Label>
              <Input type="number" value={delayMinutes} onChange={e => setDelayMinutes(Number(e.target.value))} min={5} step={5} className="bg-muted border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Reason</Label>
              <Input value={delayReason} onChange={e => setDelayReason(e.target.value)} placeholder="Weather, technical, traffic..." className="bg-muted border-border" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelay(null)}>Cancel</Button>
            <Button onClick={handleDelay} className="bg-[hsl(var(--status-delayed))] text-black hover:opacity-90">
              Confirm Delay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
