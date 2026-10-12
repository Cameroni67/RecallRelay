import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { VerifiedLabel } from "@/components/verified-label";
import type { Product } from "@/lib/data";

function productWithChain(chain: Product["chain"]): Product {
  return {
    id: "u1",
    maker: "Northstar Outdoor Tech",
    name: "HeatCore 10K",
    category: "Portable battery pack",
    model: "HC10",
    serial: "HC10-2048",
    image: "/products/heatcore.svg",
    owner: "You",
    ownerSince: "October 8, 2026",
    safety: "clear",
    lastAction: "No active recalls",
    chain,
  };
}

describe("public verification status", () => {
  it("shows a verified state only when the server observed an on-chain record", () => {
    const product = productWithChain({
      programId: "GjKJEvRqGmP3uoAWWTRYCtRAhFVAnf1MDFKdZoPCR4hP",
      pda: "Pda11111111111111111111111111111111111111",
      owner: "Owner11111111111111111111111111111111111",
      transferCount: 0,
      txSignature: null,
      syncedAt: "2026-10-09T00:00:00Z",
    });
    render(<VerifiedLabel recalled={false} product={product} />);
    expect(screen.getByText("Verified on Solana · authentic registration")).toBeInTheDocument();
  });

  it("marks an active recall when the unit is verified and recalled", () => {
    const product = productWithChain({
      programId: "GjKJEvRqGmP3uoAWWTRYCtRAhFVAnf1MDFKdZoPCR4hP",
      pda: "Pda11111111111111111111111111111111111111",
      owner: "Owner11111111111111111111111111111111111",
      transferCount: 0,
      txSignature: null,
      syncedAt: "2026-10-09T00:00:00Z",
    });
    render(<VerifiedLabel recalled product={product} />);
    expect(screen.getByText("Verified on Solana · active recall")).toBeInTheDocument();
  });

  it("never claims verification for a unit with no on-chain record", () => {
    render(<VerifiedLabel recalled={false} product={productWithChain(null)} />);
    expect(screen.getByText("Registered with RecallRelay · no on-chain record")).toBeInTheDocument();
  });

  it("shows awaiting confirmation while a registration is unconfirmed", () => {
    const product = productWithChain({
      programId: "GjKJEvRqGmP3uoAWWTRYCtRAhFVAnf1MDFKdZoPCR4hP",
      pda: "Pda11111111111111111111111111111111111111",
      owner: null,
      transferCount: 0,
      txSignature: null,
      syncedAt: null,
    });
    render(<VerifiedLabel recalled={false} product={product} />);
    expect(screen.getByText("Awaiting on-chain confirmation…")).toBeInTheDocument();
  });
});
