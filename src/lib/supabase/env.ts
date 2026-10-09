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
  const value = process.env[name];
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
