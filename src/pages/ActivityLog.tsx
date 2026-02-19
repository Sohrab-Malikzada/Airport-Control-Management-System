import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Plane, Wind, Users, Bell, Radio } from "lucide-react";

interface ActivityEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
  user_id: string | null;
}

const entityIcons: Record<string, React.FC<{className?: string}>> = {
  flight: Plane,
  runway: Wind,
  passenger: Users,
  alert: Bell,
  atc: Radio,
};

const entityColors: Record<string, string> = {
  flight: "text-primary bg-primary/10",
  runway: "text-[hsl(var(--runway-available))] bg-[hsl(var(--runway-available)/0.1)]",
  passenger: "text-[hsl(var(--status-boarding))] bg-[hsl(var(--status-boarding)/0.1)]",
  alert: "text-[hsl(var(--severity-warning))] bg-[hsl(var(--severity-warning)/0.1)]",
  atc: "text-[hsl(var(--status-emergency))] bg-[hsl(var(--status-emergency)/0.1)]",
};

export default function ActivityLog() {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const fetchActivities = async () => {
    const { data } = await supabase
      .from("activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setActivities((data || []) as ActivityEntry[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchActivities();
    const channel = supabase.channel("activity-log-page")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_log" }, fetchActivities)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = filter === "all" ? activities : activities.filter(a => a.entity_type === filter);

  const entityTypes = ["all", ...Array.from(new Set(activities.map(a => a.entity_type)))];

  return (
    <AppLayout title="Activity Log">
      <div className="space-y-4 animate-fade-in-up">
        <div className="flex items-center gap-2 flex-wrap">
          {entityTypes.map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all capitalize ${
                filter === t
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "bg-card text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="glass-card rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Activity className="w-4 h-4 text-muted-foreground" />
              Activity Timeline
            </h3>
            <span className="text-xs text-muted-foreground">{filtered.length} entries</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading activity...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No activity recorded yet.</div>
          ) : (
            <div className="divide-y divide-border/50">
              {filtered.map((a, i) => {
                const Icon = entityIcons[a.entity_type] || Activity;
                const colorCls = entityColors[a.entity_type] || "text-muted-foreground bg-muted";
                return (
                  <div key={a.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/20 transition-colors">
                    <div className={`p-1.5 rounded-lg ${colorCls} shrink-0`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{a.action}</p>
                    </div>
                    <div className={`text-xs font-medium px-2 py-0.5 rounded capitalize ${colorCls}`}>
                      {a.entity_type}
                    </div>
                    <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                      {new Date(a.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
