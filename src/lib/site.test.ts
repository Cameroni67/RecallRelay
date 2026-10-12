import { afterEach, describe, expect, it, vi } from "vitest";
import { siteOrigin, verifyPath, verifyUrl } from "@/lib/site";

describe("site link helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("derives verification URLs from NEXT_PUBLIC_SITE_URL, never a hardcoded host", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://recallrelay.app/");
    expect(siteOrigin()).toBe("https://recallrelay.app");
    expect(verifyUrl("HC10-2048")).toBe("https://recallrelay.app/verify/HC10-2048");
    expect(verifyUrl("HC10-2048")).not.toContain("localhost");
    expect(verifyUrl("HC10-2048")).not.toContain("127.0.0.1");
  });

  it("returns null without a site URL so callers fall back to the browser origin", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(verifyUrl("HC10-2048")).toBeNull();
    vi.unstubAllEnvs();
    expect(verifyUrl("HC10-2048")).toBeNull();
  });

  it("encodes the serial into the public path", () => {
    expect(verifyPath("HC10-2048")).toBe("/verify/HC10-2048");
    expect(verifyPath("HC10 2048/x")).toBe("/verify/HC10%202048%2Fx");
  });
});
