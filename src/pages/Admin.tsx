import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Users, Check } from "lucide-react";

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

export default function Admin() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const roleMap: Record<string, string> = {};
    (roles || []).forEach(r => { roleMap[r.user_id] = r.role; });
    setUsers(
      (profiles || []).map(p => ({ id: p.id, full_name: p.full_name, email: p.email, role: roleMap[p.id] || "staff" }))
    );
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    const { error } = await supabase
      .from("user_roles")
      .upsert([{ user_id: userId, role: newRole as "admin" | "atc" | "staff" }], { onConflict: "user_id" });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Role Updated", description: `Role changed to ${newRole}.` });
      fetchUsers();
    }
  };

  const roleColors: Record<string, string> = {
    admin: "text-[hsl(var(--status-emergency))]",
    atc: "text-primary",
    staff: "text-[hsl(var(--status-departed))]",
  };

  return (
    <AppLayout title="Admin Panel">
      <div className="space-y-4 animate-fade-in-up">
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">User Role Management</h3>
          </div>
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading users...</div>
          ) : (
            <div className="divide-y divide-border/50">
              {users.map(u => (
                <div key={u.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/20 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                    {u.full_name?.[0]?.toUpperCase() || "U"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{u.full_name || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <span className={`text-xs font-semibold capitalize ${roleColors[u.role]}`}>{u.role}</span>
                  <Select value={u.role} onValueChange={v => handleRoleChange(u.id, v)}>
                    <SelectTrigger className="w-28 h-8 bg-muted border-border text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="atc">ATC</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card rounded-xl p-4 border border-[hsl(var(--severity-warning)/0.3)] severity-warning">
          <p className="text-sm text-[hsl(var(--severity-warning))] font-medium flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Role Permissions Summary
          </p>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { role: "Admin", perms: ["All permissions", "User management", "Full system access"] },
              { role: "ATC", perms: ["Flight management", "Runway control", "ATC panel", "Create alerts"] },
              { role: "Staff", perms: ["View flights", "Passenger management", "View alerts"] },
            ].map(({ role, perms }) => (
              <div key={role} className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm font-semibold text-foreground mb-2">{role}</p>
                {perms.map(p => (
                  <div key={p} className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <Check className="w-3 h-3 text-[hsl(var(--status-departed))]" />
                    {p}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
