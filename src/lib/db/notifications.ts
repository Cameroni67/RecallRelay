import { getServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

function fail(error: { message: string }): never {
  throw new Error(`RecallRelay database error: ${error.message}`);
}

/**
 * Notifications for one profile. Reads are scoped to the profile id AND to
 * the caller's RLS (notifications_select_own): one user can never list or
 * read another user's notifications.
 */
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
        body: "Battery overheating risk. Stop using immediately and contact the manufacturer.",
        recall_id: null,
        unit_id: null,
        read_at: null,
        created_at: "2026-10-09T08:00:00.000Z",
        dedupe_key: null,
      } satisfies NotificationRow,
    ];
  }
  if (!profileId) return [];
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });
  if (error) fail(error);
  return data ?? [];
}

/** Unread badge count for the signed-in profile (0 when unavailable). */
export async function getUnreadNotificationCount(
  profileId: string | null,
): Promise<number> {
  const supabase = await getServerClient();
  if (!supabase || !profileId) return 0;
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .is("read_at", null);
  if (error) fail(error);
  return count ?? 0;
}

/**
 * Marks one of the caller's OWN notifications as read. RLS only allows
 * updating `read_at` on rows the caller owns; the profile filter is a second
 * guard on top of it.
 */
export async function markNotificationRead(
  profileId: string,
  notificationId: string,
): Promise<void> {
  const supabase = await getServerClient();
  if (!supabase) return;
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("profile_id", profileId);
  if (error) fail(error);
}
