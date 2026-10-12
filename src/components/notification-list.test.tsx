import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NotificationList, type NotificationItem } from "@/components/notification-list";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const items: NotificationItem[] = [
  {
    id: "n-1",
    kind: "transfer",
    severity: "info",
    title: "Ownership transferred",
    body: "TrailRadio 4 was transferred to you.",
    recall_id: null,
    unit_id: "unit-tr4",
    read_at: "2026-10-08T10:00:00.000Z",
    created_at: "2026-10-08T10:00:00.000Z",
  },
  {
    id: "n-2",
    kind: "recall",
    severity: "urgent",
    title: "Recall issued for HeatCore 10K",
    body: "Battery overheating risk. Stop using immediately and contact the manufacturer.",
    recall_id: "recall-hc10-2026",
    unit_id: "HC10-2048",
    read_at: null,
    created_at: "2026-10-09T08:00:00.000Z",
  },
];

describe("NotificationList", () => {
  it("renders only the caller's items with unread state and read controls", () => {
    render(<NotificationList items={items} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Ownership transferred")).toBeInTheDocument();
    expect(screen.getByText("UNREAD")).toBeInTheDocument();
    expect(screen.getByText("1 unread")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark read" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark all as read" })).toBeInTheDocument();
    // The recall notification deep-links to the owner recall detail page.
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/app/products/unit-tr4",
      "/app/recalls/recall-hc10-2026",
    ]);
  });

  it("hides mark-read controls in demo mode (no writes without a database)", () => {
    render(<NotificationList items={items} demo />);
    expect(screen.queryByRole("button", { name: "Mark read" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark all as read" })).not.toBeInTheDocument();
    expect(screen.getByText("UNREAD")).toBeInTheDocument();
  });

  it("shows a friendly empty state", () => {
    render(<NotificationList items={[]} />);
    expect(screen.getByText("No notifications")).toBeInTheDocument();
  });
});
