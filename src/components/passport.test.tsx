import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ProductPassport } from "@/components/passport";
import { primaryProduct, products } from "@/lib/data";

describe("ProductPassport", () => {
  it("renders the calm safety state for a clear product", () => {
    const safeProduct = products.find((product) => product.safety === "clear")!;
    render(<ProductPassport product={safeProduct} />);
    expect(screen.getByRole("heading", { name: safeProduct.name })).toBeInTheDocument();
    expect(screen.getByText("No active recalls")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("surfaces the urgent recall while preserving the passport identity", () => {
    render(<ProductPassport product={primaryProduct} />);
    expect(screen.getByRole("heading", { name: "HeatCore 10K" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Stop using immediately");
    expect(within(screen.getByRole("alert")).getByRole("link", { name: "View Recall" })).toHaveAttribute("href", "/app/recalls");
  });
});
