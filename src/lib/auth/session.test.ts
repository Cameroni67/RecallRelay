import { describe, expect, it } from "vitest";
import { requireOwner, requireManufacturer, demoProfile, demoManufacturer } from "@/lib/auth/session";

describe("workspace context", () => {
  it("returns the demo owner context without redirecting when env is unconfigured", async () => {
    const owner = await requireOwner();
    expect(owner.demo).toBe(true);
    expect(owner.supabase).toBeNull();
    expect(owner.userId).toBeNull();
    expect(owner.profile.full_name).toBe(demoProfile.full_name);
    expect(owner.workspaceName).toBe("Bob Chen");
  });

  it("returns the demo manufacturer workspace without membership checks", async () => {
    const ctx = await requireManufacturer();
    expect(ctx.demo).toBe(true);
    expect(ctx.manufacturer.name).toBe(demoManufacturer.name);
    expect(ctx.manufacturer.verified).toBe(true);
    expect(ctx.workspaceName).toBe("Northstar Outdoor Tech");
  });
});
