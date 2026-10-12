import { describe, expect, it } from "vitest";
import { qrSvg } from "@/lib/qr";

describe("qrSvg", () => {
  it("renders a real QR SVG for the public verification URL", async () => {
    const svg = await qrSvg("https://recallrelay.app/verify/HC10-2048");
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    // A real QR module grid is far larger than an empty placeholder.
    expect(svg.length).toBeGreaterThan(500);
  });

  it("produces different codes for different serials", async () => {
    const first = await qrSvg("https://recallrelay.app/verify/HC10-2048");
    const second = await qrSvg("https://recallrelay.app/verify/TR4-0831");
    expect(first).not.toBe(second);
  });
});
