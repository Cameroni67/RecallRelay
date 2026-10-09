import { getServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { demoProfile } from "@/lib/auth/session";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export type OwnerProfile = ProfileRow;

function fail(error: { message: string }): never {
  throw new Error(`RecallRelay database error: ${error.message}`);
}

export async function getProfile(profileId: string): Promise<OwnerProfile | null> {
  const supabase = await getServerClient();
  if (!supabase) return demoProfile;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .maybeSingle();
  if (error) fail(error);
  return data;
}

export async function updateProfile(
  profileId: string,
  patch: { full_name?: string; notification_prefs?: { safety: boolean; transfers: boolean } },
): Promise<void> {
  const supabase = await getServerClient();
  if (!supabase) return;
  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", profileId);
  if (error) fail(error);
}
