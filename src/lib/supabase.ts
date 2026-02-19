import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export { supabase };

// Helper to log activity
export async function logActivity(
  userId: string,
  action: string,
  entityType: string,
  entityId?: string,
  details?: Record<string, unknown>
) {
  await supabase.from("activity_log").insert([{
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId ?? null,
    details: (details || {}) as Json,
  }]);
}
