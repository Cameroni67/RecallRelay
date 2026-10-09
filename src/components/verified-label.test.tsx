import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { VerifiedLabel } from "@/components/verified-label";

describe("public verification status", () => {
  it("resolves to a verified recall state", async () => {
    render(<VerifiedLabel recalled />);
    expect(screen.getByText("Checking registration…")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Verified · active recall")).toBeInTheDocument());
  });
});
