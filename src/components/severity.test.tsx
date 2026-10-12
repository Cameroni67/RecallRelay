import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SeverityMark } from "@/components/severity";

describe("SeverityMark", () => {
  it("always pairs an icon with an explicit text label (never color alone)", () => {
    const { container } = render(
      <div>
        <SeverityMark severity="urgent" />
        <SeverityMark severity="important" />
        <SeverityMark severity="advisory" />
      </div>,
    );
    expect(screen.getByText("Urgent recall")).toBeInTheDocument();
    expect(screen.getByText("Important recall")).toBeInTheDocument();
    expect(screen.getByText("Advisory notice")).toBeInTheDocument();
    expect(container.querySelectorAll("svg").length).toBeGreaterThanOrEqual(3);
  });

  it("keeps the label in compact mode too", () => {
    render(<SeverityMark severity="urgent" compact />);
    expect(screen.getByText("Urgent recall")).toBeInTheDocument();
  });

  it("falls back to urgent for unknown or missing severity", () => {
    const { rerender } = render(<SeverityMark severity="unknown-level" />);
    expect(screen.getByText("Urgent recall")).toBeInTheDocument();
    rerender(<SeverityMark severity={null} />);
    expect(screen.getByText("Urgent recall")).toBeInTheDocument();
  });
});
