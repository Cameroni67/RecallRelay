import { describe, expect, it } from "vitest";
import { getDataLabel, getPublicEnv, type PublicEnv } from "@/lib/supabase/env";

function env(partial: Partial<PublicEnv>): PublicEnv {
  return {
    mode: null,
    url: null,
    publishableKey: null,
    databaseConfigured: false,
    ...partial,
  };
}

describe("public env", () => {
  it("reports demo mode when the Supabase variables are missing", () => {
    expect(getPublicEnv().databaseConfigured).toBe(false);
    expect(getDataLabel()).toBe("Demo data");
  });

  it("maps local and hosted modes onto badge labels", () => {
    expect(getDataLabel(env({ databaseConfigured: true, mode: "local" }))).toBe("Local data");
    expect(getDataLabel(env({ databaseConfigured: true, mode: "hosted" }))).toBe("Hosted data");
  });

  it("falls back to local when configured without an explicit mode", () => {
    expect(getDataLabel(env({ databaseConfigured: true, mode: null }))).toBe("Local data");
  });
});
