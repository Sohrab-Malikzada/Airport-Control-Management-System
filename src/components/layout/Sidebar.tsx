import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, Plane, Wind, Radio, Users,
  Bell, LogOut, ChevronLeft, ChevronRight, Shield,
  Activity
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { to: "/flights", icon: Plane, label: "Flights" },
  { to: "/runways", icon: Wind, label: "Runways" },
  { to: "/atc", icon: Radio, label: "ATC Panel" },
  { to: "/passengers", icon: Users, label: "Passengers" },
  { to: "/alerts", icon: Bell, label: "Alerts" },
  { to: "/activity", icon: Activity, label: "Activity Log" },
];

const adminItems = [
  { to: "/admin", icon: Shield, label: "Admin" },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { profile, role, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    toast({ title: "Signed out", description: "See you next time!" });
    navigate("/auth");
  };

  const roleColors: Record<string, string> = {
    admin: "text-[hsl(var(--status-emergency))]",
    atc: "text-primary",
    staff: "text-[hsl(var(--status-departed))]",
  };

  const roleLabel: Record<string, string> = {
    admin: "Administrator",
    atc: "Air Traffic Control",
    staff: "Staff",
  };

  return (
    <aside
      className={cn(
        "flex flex-col bg-sidebar h-screen border-r border-sidebar-border transition-all duration-300 shrink-0",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Header */}
      <div className={cn(
        "flex items-center h-16 px-4 border-b border-sidebar-border",
        collapsed ? "justify-center" : "justify-between"
      )}>
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Plane className="w-4 h-4 text-primary" />
            </div>
            <span className="font-bold text-sm text-foreground tracking-wide">AeroControl</span>
          </div>
        )}
        {collapsed && (
          <Plane className="w-5 h-5 text-primary" />
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors",
            collapsed && "hidden"
          )}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="mx-auto mt-2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto scrollbar-custom">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group",
                isActive
                  ? "bg-primary/15 text-primary border border-primary/20"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                collapsed && "justify-center px-2"
              )
            }
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}

        {role === "admin" && (
          <>
            {!collapsed && (
              <div className="pt-4 pb-1 px-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Admin</span>
              </div>
            )}
            {adminItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                    isActive
                      ? "bg-primary/15 text-primary border border-primary/20"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    collapsed && "justify-center px-2"
                  )
                }
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* User */}
      <div className="px-2 py-3 border-t border-sidebar-border">
        {!collapsed && (
          <div className="px-3 py-2 mb-1">
            <p className="text-sm font-medium text-foreground truncate">{profile?.full_name || "User"}</p>
            <p className={cn("text-xs font-medium mt-0.5", roleColors[role || "staff"])}>
              {roleLabel[role || "staff"]}
            </p>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all",
            collapsed && "justify-center px-2"
          )}
          title={collapsed ? "Sign Out" : undefined}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
