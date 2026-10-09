import { getServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

function fail(error: { message: string }): never {
  throw new Error(`RecallRelay database error: ${error.message}`);
}

export async function getNotifications(
  profileId: string | null,
): Promise<NotificationRow[]> {
  const supabase = await getServerClient();
  if (!supabase) {
    return [
      {
        id: "demo-notification",
        profile_id: "demo-profile",
        kind: "recall",
        severity: "urgent",
        title: "Recall issued for HeatCore 10K",
        body: "Battery overheating risk. Stop using immediately.",
        recall_id: null,
        unit_id: null,
        read_at: null,
        created_at: "2026-10-09T08:00:00.000Z",
      } satisfies NotificationRow,
    ];
  }
  if (!profileId) return [];
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) fail(error);
  return data ?? [];
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const supabase = await getServerClient();
  if (!supabase) return;
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);
  if (error) fail(error);
}
