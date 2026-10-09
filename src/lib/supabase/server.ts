import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getPublicEnv } from "@/lib/supabase/env";

export type ServerSupabase = SupabaseClient<Database>;

/**
 * Cookie-aware server client, or null when the environment is not configured
 * (demo mode falls back to Phase 1 fixtures).
 */
export async function getServerClient(): Promise<ServerSupabase | null> {
  const env = getPublicEnv();
  if (!env.databaseConfigured || !env.url || !env.publishableKey) return null;

  const cookieStore = await cookies();
  return createServerClient<Database>(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot write cookies; the browser client refreshes them.
        }
      },
    },
  });
}
