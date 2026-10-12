import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PublicVerification } from "@/components/public-verification";
import { primaryProduct, products } from "@/lib/data";

describe("PublicVerification", () => {
  it("shows real recall, safety and ownership state without exposing owner identity", () => {
    const recalled = products.find((product) => product.recall) ?? primaryProduct;
    const { container } = render(<PublicVerification product={recalled} />);

    // Safety first after identity: real recall data, severity stated in text.
    expect(screen.getByRole("alert")).toHaveTextContent("URGENT RECALL");
    expect(screen.getByRole("alert")).toHaveTextContent("Battery overheating risk");
    expect(screen.getByText("Required action")).toBeInTheDocument();
    expect(
      screen.getByText("Stop using immediately and contact the manufacturer."),
    ).toBeInTheDocument();

    // Chain-backed ownership without identity.
    expect(screen.getByText("Current ownership recorded")).toBeInTheDocument();

    // Public history (safe kinds only) + Solana transparency (secondary).
    expect(screen.getByText("Product history")).toBeInTheDocument();
    expect(screen.getByText("Solana record")).toBeInTheDocument();
    expect(screen.getByText(/Solana Devnet/)).toBeInTheDocument();

    // Privacy: no owner names, emails or wallet ids anywhere on the page.
    expect(container.textContent).not.toContain("Bob Chen");
    expect(container.textContent).not.toContain("Alice");
    expect(container.textContent).not.toMatch(/@/);
    expect(container.textContent).not.toMatch(/0x[a-f0-9]{8,}/i);
  });

  it("shows the calm state for a clear product", () => {
    const safe = products.find((product) => product.safety === "clear" && !product.recall)!;
    render(<PublicVerification product={safe} />);
    expect(screen.getByText("No active recalls")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("Required action")).not.toBeInTheDocument();
  });
});
