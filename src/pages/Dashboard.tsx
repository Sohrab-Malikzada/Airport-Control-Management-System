import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Plane, Wind, Users, Bell, AlertTriangle, TrendingUp, Clock, CheckCircle } from "lucide-react";

interface Stats {
  totalFlights: number;
  activeFlights: number;
  delayedFlights: number;
  emergencies: number;
  totalPassengers: number;
  availableRunways: number;
  scheduledFlights: number;
  cancelledFlights: number;
}

interface Activity {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
  user_id: string | null;
}

interface Alert {
  id: string;
  title: string;
  message: string;
  severity: string;
  created_at: string;
}

interface Flight {
  id: string;
  flight_number: string;
  airline: string;
  origin: string;
  destination: string;
  status: string;
  scheduled_departure: string;
}

const statusBadgeMap: Record<string, string> = {
  scheduled: "bg-[hsl(var(--status-scheduled)/0.15)] text-[hsl(var(--status-scheduled))] border-[hsl(var(--status-scheduled)/0.3)]",
  boarding: "bg-[hsl(var(--status-boarding)/0.15)] text-[hsl(var(--status-boarding))] border-[hsl(var(--status-boarding)/0.3)]",
  delayed: "bg-[hsl(var(--status-delayed)/0.15)] text-[hsl(var(--status-delayed))] border-[hsl(var(--status-delayed)/0.3)]",
  departed: "bg-[hsl(var(--status-departed)/0.15)] text-[hsl(var(--status-departed))] border-[hsl(var(--status-departed)/0.3)]",
  landed: "bg-[hsl(var(--status-landed)/0.15)] text-[hsl(var(--status-landed))] border-[hsl(var(--status-landed)/0.3)]",
  cancelled: "bg-[hsl(var(--status-cancelled)/0.15)] text-[hsl(var(--status-cancelled))] border-[hsl(var(--status-cancelled)/0.3)]",
  emergency: "bg-[hsl(var(--status-emergency)/0.15)] text-[hsl(var(--status-emergency))] border-[hsl(var(--status-emergency)/0.3)]",
};

export default function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalFlights: 0, activeFlights: 0, delayedFlights: 0, emergencies: 0,
    totalPassengers: 0, availableRunways: 0, scheduledFlights: 0, cancelledFlights: 0,
  });
  const [activities, setActivities] = useState<Activity[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [flights, setFlights] = useState<Flight[]>([]);

  const fetchData = async () => {
    const [flightsRes, passengersRes, runwaysRes, activitiesRes, alertsRes] = await Promise.all([
      supabase.from("flights").select("*"),
      supabase.from("passengers").select("id", { count: "exact" }),
      supabase.from("runways").select("status"),
      supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(10),
      supabase.from("alerts").select("*").eq("is_active", true).eq("is_acknowledged", false).order("created_at", { ascending: false }).limit(5),
    ]);

    const f = flightsRes.data || [];
    setStats({
      totalFlights: f.length,
      activeFlights: f.filter(x => ["boarding", "departed"].includes(x.status)).length,
      delayedFlights: f.filter(x => x.status === "delayed").length,
      emergencies: f.filter(x => x.status === "emergency").length,
      totalPassengers: passengersRes.count || 0,
      availableRunways: (runwaysRes.data || []).filter(r => r.status === "available").length,
      scheduledFlights: f.filter(x => x.status === "scheduled").length,
      cancelledFlights: f.filter(x => x.status === "cancelled").length,
    });

    setFlights(f.slice(0, 6));
    setActivities((activitiesRes.data || []) as unknown as Activity[]);
    setAlerts((alertsRes.data || []) as unknown as Alert[]);
  };

  useEffect(() => {
    fetchData();
    const channels = [
      supabase.channel("dash-flights").on("postgres_changes", { event: "*", schema: "public", table: "flights" }, fetchData).subscribe(),
      supabase.channel("dash-alerts").on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, fetchData).subscribe(),
      supabase.channel("dash-activity").on("postgres_changes", { event: "*", schema: "public", table: "activity_log" }, fetchData).subscribe(),
    ];
    return () => { channels.forEach(c => supabase.removeChannel(c)); };
  }, []);

  const statCards = [
    { label: "Total Flights", value: stats.totalFlights, icon: Plane, color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
    { label: "Active Flights", value: stats.activeFlights, icon: TrendingUp, color: "text-[hsl(var(--status-departed))]", bg: "bg-[hsl(var(--status-departed)/0.1)]", border: "border-[hsl(var(--status-departed)/0.2)]" },
    { label: "Delayed", value: stats.delayedFlights, icon: Clock, color: "text-[hsl(var(--status-delayed))]", bg: "bg-[hsl(var(--status-delayed)/0.1)]", border: "border-[hsl(var(--status-delayed)/0.2)]" },
    { label: "Emergencies", value: stats.emergencies, icon: AlertTriangle, color: "text-[hsl(var(--status-emergency))]", bg: "bg-[hsl(var(--status-emergency)/0.1)]", border: "border-[hsl(var(--status-emergency)/0.2)]" },
    { label: "Passengers", value: stats.totalPassengers, icon: Users, color: "text-[hsl(var(--status-boarding))]", bg: "bg-[hsl(var(--status-boarding)/0.1)]", border: "border-[hsl(var(--status-boarding)/0.2)]" },
    { label: "Available Runways", value: stats.availableRunways, icon: Wind, color: "text-[hsl(var(--runway-available))]", bg: "bg-[hsl(var(--runway-available)/0.1)]", border: "border-[hsl(var(--runway-available)/0.2)]" },
    { label: "Scheduled", value: stats.scheduledFlights, icon: CheckCircle, color: "text-[hsl(var(--status-scheduled))]", bg: "bg-[hsl(var(--status-scheduled)/0.1)]", border: "border-[hsl(var(--status-scheduled)/0.2)]" },
    { label: "Active Alerts", value: alerts.length, icon: Bell, color: "text-[hsl(var(--severity-warning))]", bg: "bg-[hsl(var(--severity-warning)/0.1)]", border: "border-[hsl(var(--severity-warning)/0.2)]" },
  ];

  const severityColors: Record<string, string> = {
    info: "text-[hsl(var(--severity-info))]",
    warning: "text-[hsl(var(--severity-warning))]",
    critical: "text-[hsl(var(--severity-critical))]",
    emergency: "text-[hsl(var(--severity-emergency))] animate-pulse",
  };

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6 animate-fade-in-up">
        {/* Welcome */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"},{" "}
              {profile?.full_name?.split(" ")[0] || "Controller"}
            </h2>
            <p className="text-muted-foreground text-sm mt-0.5">
              {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          {stats.emergencies > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[hsl(var(--status-emergency)/0.15)] border border-[hsl(var(--status-emergency)/0.3)] animate-pulse">
              <AlertTriangle className="w-4 h-4 text-[hsl(var(--status-emergency))]" />
              <span className="text-sm font-semibold text-[hsl(var(--status-emergency))]">
                {stats.emergencies} Emergency Active
              </span>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statCards.map((card) => (
            <div key={card.label} className={`glass-card rounded-xl p-4 border ${card.border}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{card.label}</p>
                  <p className={`text-3xl font-bold mt-1 ${card.color}`}>{card.value}</p>
                </div>
                <div className={`p-2 rounded-lg ${card.bg} border ${card.border}`}>
                  <card.icon className={`w-4 h-4 ${card.color}`} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Recent Flights */}
          <div className="lg:col-span-2 glass-card rounded-xl p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Plane className="w-4 h-4 text-primary" />
              Recent Flights
            </h3>
            <div className="space-y-2">
              {flights.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">No flights yet. Add your first flight!</p>
              ) : (
                flights.map(f => (
                  <div key={f.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-bold text-primary">{f.flight_number}</span>
                      <span className="text-sm text-muted-foreground">{f.airline}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">{f.origin} → {f.destination}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded border capitalize ${statusBadgeMap[f.status] || ""}`}>
                        {f.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Active Alerts */}
          <div className="glass-card rounded-xl p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Bell className="w-4 h-4 text-[hsl(var(--severity-warning))]" />
              Active Alerts
            </h3>
            <div className="space-y-2">
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-muted-foreground text-sm gap-2">
                  <CheckCircle className="w-8 h-8 text-[hsl(var(--status-departed))]" />
                  <span>All clear!</span>
                </div>
              ) : (
                alerts.map(a => (
                  <div key={a.id} className={`p-3 rounded-lg border ${
                    a.severity === "emergency" ? "severity-emergency" :
                    a.severity === "critical" ? "severity-critical" :
                    a.severity === "warning" ? "severity-warning" : "severity-info"
                  }`}>
                    <p className={`text-xs font-semibold ${severityColors[a.severity]}`}>{a.severity.toUpperCase()}</p>
                    <p className="text-sm font-medium text-foreground mt-0.5">{a.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Activity Log */}
        <div className="glass-card rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            Recent Activity
          </h3>
          <div className="space-y-1">
            {activities.length === 0 ? (
              <p className="text-muted-foreground text-sm py-3 text-center">No recent activity.</p>
            ) : (
              activities.map(a => (
                <div key={a.id} className="flex items-center gap-4 py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                    {new Date(a.created_at).toLocaleTimeString()}
                  </span>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-medium capitalize">
                    {a.entity_type}
                  </span>
                  <span className="text-sm text-foreground flex-1">{a.action}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
