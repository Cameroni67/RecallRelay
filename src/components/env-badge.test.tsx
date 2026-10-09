import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EnvBadge } from "@/components/env-badge";

describe("EnvBadge", () => {
  it("shows the demo data label when Supabase is unconfigured", () => {
    render(<EnvBadge />);
    expect(screen.getByTestId("env-badge")).toHaveTextContent("Demo data");
  });
});
