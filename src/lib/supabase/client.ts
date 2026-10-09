"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getPublicEnv } from "@/lib/supabase/env";

export type BrowserSupabase = SupabaseClient<Database>;

/** Browser client, or null when the environment is not configured (demo mode). */
export function getBrowserClient(): BrowserSupabase | null {
  const env = getPublicEnv();
  if (!env.databaseConfigured || !env.url || !env.publishableKey) return null;
  return createBrowserClient<Database>(env.url, env.publishableKey);
}
