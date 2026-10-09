import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TransferFlow } from "@/components/transfer-flow";
import { primaryProduct } from "@/lib/data";

describe("TransferFlow", () => {
  it("requires a recipient and supports review and local completion", () => {
    render(<TransferFlow product={primaryProduct} />);
    const recipient = screen.getByLabelText("Recipient");
    fireEvent.change(recipient, { target: { value: "Bob Chen" } });
    fireEvent.click(screen.getByRole("button", { name: "Review Transfer" }));
    expect(screen.getByText("New owner")).toBeInTheDocument();
    expect(screen.getByText("Bob Chen")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm Transfer" }));
    expect(screen.getByRole("heading", { name: "Ownership transferred" })).toBeInTheDocument();
    expect(screen.getByText("HeatCore 10K now belongs to Bob Chen.")).toBeInTheDocument();
  });
});
