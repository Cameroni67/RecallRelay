import { redirect } from "next/navigation";
import { getServerClient, type ServerSupabase } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/supabase/env";
import type { Database } from "@/lib/supabase/database.types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type MembershipRow = {
  manufacturer_id: string;
  role: string;
  manufacturers: {
    id: string;
    slug: string;
    name: string;
    verified: boolean;
  } | null;
};

export type DemoProfile = ProfileRow;

export const demoProfile: ProfileRow = {
  id: "demo-profile",
  wallet_address: null,
  full_name: "Bob Chen",
  avatar_url: null,
  email: null,
  notification_prefs: { safety: true, transfers: true },
  created_at: "2026-08-22T09:00:00.000Z",
  updated_at: "2026-08-22T09:00:00.000Z",
};

export type DemoManufacturer = {
  id: string;
  slug: string;
  name: string;
  verified: boolean;
  role: string;
};

export const demoManufacturer: DemoManufacturer = {
  id: "demo-manufacturer",
  slug: "northstar-outdoor-tech",
  name: "Northstar Outdoor Tech",
  verified: true,
  role: "owner",
};

export type OwnerContext = {
  demo: boolean;
  supabase: ServerSupabase | null;
  userId: string | null;
  profile: ProfileRow;
  workspaceName: string;
};

export type ManufacturerContext = OwnerContext & {
  manufacturer: DemoManufacturer;
};

async function loadProfile(
  supabase: ServerSupabase,
  userId: string,
): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(`RecallRelay database error: ${error.message}`);
  return data;
}

async function loadMembership(
  supabase: ServerSupabase,
  profileId: string,
): Promise<MembershipRow | null> {
  const { data, error } = await supabase
    .from("manufacturer_members")
    .select("manufacturer_id, role, manufacturers ( id, slug, name, verified )")
    .eq("profile_id", profileId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`RecallRelay database error: ${error.message}`);
  return data as MembershipRow | null;
}

/**
 * Owner workspace context. Redirects to /signin when the environment is
 * configured and there is no session, or to /onboarding when the signed-in
 * user has no profile yet. Demo mode (no Supabase env) never redirects.
 */
export async function requireOwner(): Promise<OwnerContext> {
  if (!getPublicEnv().databaseConfigured) {
    return {
      demo: true,
      supabase: null,
      userId: null,
      profile: demoProfile,
      workspaceName: demoProfile.full_name,
    };
  }

  const supabase = await getServerClient();
  if (!supabase) redirect("/signin");

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/signin");

  const profile = await loadProfile(supabase, data.user.id);
  if (!profile) redirect("/onboarding");

  return {
    demo: false,
    supabase,
    userId: data.user.id,
    profile,
    workspaceName: profile.full_name,
  };
}

/** Manufacturer workspace context; also requires a membership row. */
export async function requireManufacturer(): Promise<ManufacturerContext> {
  const owner = await requireOwner();
  if (owner.demo) {
    return {
      ...owner,
      manufacturer: demoManufacturer,
      workspaceName: demoManufacturer.name,
    };
  }

  const supabase = owner.supabase as ServerSupabase;
  const membership = await loadMembership(supabase, owner.profile.id);
  if (!membership || !membership.manufacturers) redirect("/onboarding/manufacturer");

  const manufacturer = membership.manufacturers;
  return {
    ...owner,
    manufacturer: {
      id: manufacturer.id,
      slug: manufacturer.slug,
      name: manufacturer.name,
      verified: manufacturer.verified,
      role: membership.role,
    },
    workspaceName: manufacturer.name,
  };
}
