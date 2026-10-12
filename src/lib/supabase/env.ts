export type DataMode = "local" | "hosted";

export type PublicEnv = {
  /** explicit NEXT_PUBLIC_RECALLRELAY_ENV (local | hosted), null when unset/invalid */
  mode: DataMode | null;
  url: string | null;
  publishableKey: string | null;
  /** true when Supabase URL + publishable key are both present */
  databaseConfigured: boolean;
};

function read(name: string): string | null {
  // NOTE: every public variable must appear as a STATIC `process.env.NEXT_PUBLIC_*`
  // member expression below. Next.js only inlines static references into
  // production client bundles — a dynamic `process.env[name]` lookup works in
  // `next dev` and in tests (real Node process.env) but resolves to nothing in
  // the browser at runtime, which would silently switch the deployed app into
  // demo mode ("Supabase is not configured in this environment").
  const snapshot: Record<string, string | undefined> = {
    NEXT_PUBLIC_RECALLRELAY_ENV: process.env.NEXT_PUBLIC_RECALLRELAY_ENV,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
  const value = snapshot[name];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Never throws and never reads files — safe to call at module scope in both
 * server and browser code paths.
 */
export function getPublicEnv(): PublicEnv {
  const rawMode = read("NEXT_PUBLIC_RECALLRELAY_ENV");
  const mode: DataMode | null = rawMode === "local" || rawMode === "hosted" ? rawMode : null;
  const url = read("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = read("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  return {
    mode,
    url,
    publishableKey,
    databaseConfigured: Boolean(url && publishableKey),
  };
}

/** Label for the environment badge: "Hosted data" | "Local data" | "Demo data". */
export function getDataLabel(env: PublicEnv = getPublicEnv()): string {
  if (!env.databaseConfigured) return "Demo data";
  return env.mode === "hosted" ? "Hosted data" : "Local data";
}
