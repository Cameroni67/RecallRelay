import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { RecallFlow } from "@/components/recall-flow";

const units = [
  { id: "1", serialNumber: "HC10-2048", ownerName: "Bob Chen", modelId: "HC10" },
  { id: "2", serialNumber: "HC10-2049", ownerName: null, modelId: "HC10" },
  { id: "3", serialNumber: "TR4-0831", ownerName: "Alice Morgan", modelId: "TR4" },
];

describe("RecallFlow", () => {
  it("offers only the three supported severities", () => {
    render(<RecallFlow units={units} />);
    const severity = screen.getByLabelText("Severity");
    const options = within(severity)
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(options).toEqual([
      "Urgent — stop using the product",
      "Important — action recommended",
      "Advisory — information only",
    ]);
    expect(options.join(" ")).not.toMatch(/\bhigh\b/i);
  });

  it("computes the affected preview from real unit data instead of a fixed number", () => {
    render(<RecallFlow units={units} />);
    // Default scope: all units of the selected model (HC10) → 2 real units.
    expect(screen.getByText("2 units in scope")).toBeInTheDocument();
    expect(screen.queryByText(/127/)).not.toBeInTheDocument();

    // Serial range narrows the scope to the matching unit.
    fireEvent.click(screen.getByLabelText("Serial range"));
    fireEvent.change(screen.getByPlaceholderText("From e.g. HC10-2000"), {
      target: { value: "HC10-2049" },
    });
    fireEvent.change(screen.getByPlaceholderText("To e.g. HC10-2100"), {
      target: { value: "HC10-2049" },
    });
    expect(screen.getByText("1 unit in scope")).toBeInTheDocument();
  });

  it("rejects a reversed serial range before review", () => {
    render(<RecallFlow units={units} />);
    fireEvent.click(screen.getByLabelText("Serial range"));
    fireEvent.change(screen.getByPlaceholderText("From e.g. HC10-2000"), {
      target: { value: "HC10-2100" },
    });
    fireEvent.change(screen.getByPlaceholderText("To e.g. HC10-2100"), {
      target: { value: "HC10-2000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review Recall" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/reversed/i);
  });

  it("walks edit → review → published with severity and real counts", () => {
    render(<RecallFlow units={units} />);
    fireEvent.click(screen.getByRole("button", { name: "Review Recall" }));
    expect(screen.getByText(/FINAL REVIEW · URGENT RECALL/)).toBeInTheDocument();
    expect(screen.getByText("Stop using immediately and contact the manufacturer.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Publish Recall" }));
    expect(
      screen.getByRole("heading", { name: "Affected product owners have been identified." }),
    ).toBeInTheDocument();
    // Demo/mock publish reports the real scoped count and sends nothing.
    expect(screen.getByText(/2 product units in the mock scope/)).toBeInTheDocument();
    expect(screen.getByText(/No notifications were sent/)).toBeInTheDocument();
  });
});
