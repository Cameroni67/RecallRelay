import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "@/app/page";
import VerifyPage from "@/app/verify/[id]/page";

describe("public routes", () => {
  it("renders the editorial landing page and its primary action", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: /Recalls that follow the product/ })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Register a Product/ })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: /Register a Product/ })[0]).toHaveAttribute("href", "/manufacturer/register");
  });

  it("renders a public recall verification without exposing owner identity", async () => {
    const route = await VerifyPage({ params: Promise.resolve({ id: "HC10-2048" }) });
    render(route);
    expect(screen.getByRole("heading", { name: "Product verification" })).toBeInTheDocument();
    expect(screen.getByText("Current ownership verified")).toBeInTheDocument();
    expect(screen.getByText("URGENT RECALL")).toBeInTheDocument();
    expect(screen.queryByText("Bob Chen")).not.toBeInTheDocument();
  });
});
