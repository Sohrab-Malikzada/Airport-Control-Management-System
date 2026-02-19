import { useAuth } from "@/contexts/AuthContext";
import { Bell, Wifi } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function TopBar({ title }: { title: string }) {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [activeAlerts, setActiveAlerts] = useState(0);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchAlerts = async () => {
      const { count } = await supabase
        .from("alerts")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("is_acknowledged", false);
      setActiveAlerts(count || 0);
    };
    fetchAlerts();

    const channel = supabase
      .channel("alerts-topbar")
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, fetchAlerts)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const roleLabels: Record<string, string> = {
    admin: "ADMIN",
    atc: "ATC",
    staff: "STAFF",
  };

  const roleColors: Record<string, string> = {
    admin: "bg-[hsl(var(--status-emergency)/0.15)] text-[hsl(var(--status-emergency))] border-[hsl(var(--status-emergency)/0.3)]",
    atc: "bg-primary/15 text-primary border-primary/30",
    staff: "bg-[hsl(var(--status-departed)/0.15)] text-[hsl(var(--status-departed))] border-[hsl(var(--status-departed)/0.3)]",
  };

  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-card/50 backdrop-blur-sm shrink-0">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--status-departed))]">
          <span className="live-dot" />
          <span className="font-mono">LIVE</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
          <Wifi className="w-3.5 h-3.5 text-[hsl(var(--status-departed))]" />
          <span className="font-mono">{time.toUTCString().slice(17, 25)} UTC</span>
        </div>

        <button
          onClick={() => navigate("/alerts")}
          className="relative p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <Bell className="w-4 h-4 text-muted-foreground" />
          {activeAlerts > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-[hsl(var(--status-emergency))] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
              {activeAlerts > 9 ? "9+" : activeAlerts}
            </span>
          )}
        </button>

        <span className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${roleColors[role || "staff"]}`}>
          {roleLabels[role || "staff"]}
        </span>
      </div>
    </header>
  );
}
