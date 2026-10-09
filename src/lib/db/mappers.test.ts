import { describe, expect, it } from "vitest";
import {
  buildTimeline,
  findRecallForUnit,
  formatDateShort,
  mapUnitToProduct,
  unitMatchesRecall,
  type RecallScopeRow,
  type UnitRow,
} from "@/lib/db/mappers";

const model = {
  id: "model-1",
  sku: "HC10",
  name: "HeatCore 10K",
  category: "Portable battery pack",
  image_path: "/products/heatcore.svg",
  manufacturer_id: "mfr-1",
  manufacturers: { name: "Northstar Outdoor Tech" },
};

function unit(partial: Partial<UnitRow> = {}): UnitRow {
  return {
    id: "unit-1",
    model_id: "model-1",
    serial_number: "HC10-2048",
    registered_at: "2026-10-01T00:00:00.000Z",
    current_owner_profile_id: "owner-1",
    ...partial,
  };
}

function recall(partial: Partial<RecallScopeRow> = {}): RecallScopeRow {
  return {
    id: "recall-1",
    manufacturer_id: "mfr-1",
    model_id: "model-1",
    title: "Battery overheating risk",
    severity: "urgent",
    required_action: "Stop using immediately.",
    scope_kind: "all_units",
    serial_from: null,
    serial_to: null,
    issued_at: "2026-10-09T08:00:00.000Z",
    status: "active",
    ...partial,
  };
}

describe("recall scope matching", () => {
  it("matches every unit of the model for all_units", () => {
    expect(unitMatchesRecall(unit(), recall({ scope_kind: "all_units" }))).toBe(true);
    expect(unitMatchesRecall(unit({ model_id: "other" }), recall({ scope_kind: "all_units" }))).toBe(false);
  });

  it("applies lexicographic serial ranges on the same model", () => {
    const scoped = recall({ scope_kind: "serial_range", serial_from: "HC10-2000", serial_to: "HC10-2100" });
    expect(unitMatchesRecall(unit({ serial_number: "HC10-2048" }), scoped)).toBe(true);
    expect(unitMatchesRecall(unit({ serial_number: "HC10-2200" }), scoped)).toBe(false);
    expect(unitMatchesRecall(unit({ serial_number: "HC10-2048", model_id: "other" }), scoped)).toBe(false);
  });

  it("limits selected_units to the recall_units join table", () => {
    const scoped = recall({ scope_kind: "selected_units", recall_units: [{ unit_id: "unit-1" }] });
    expect(unitMatchesRecall(unit(), scoped)).toBe(true);
    expect(unitMatchesRecall(unit({ id: "unit-2" }), scoped)).toBe(false);
  });

  it("never matches draft recalls", () => {
    expect(unitMatchesRecall(unit(), recall({ status: "draft" }))).toBe(false);
  });

  it("picks the most recent active recall for a unit", () => {
    const older = recall({ id: "older", issued_at: "2026-09-01T00:00:00.000Z" });
    const newer = recall({ id: "newer", issued_at: "2026-10-09T00:00:00.000Z" });
    expect(findRecallForUnit(unit(), [older, newer])?.id).toBe("newer");
    expect(findRecallForUnit(unit(), [])).toBeNull();
  });
});

describe("unit mapping", () => {
  it("surfaces an urgent recall as safety status and last action", () => {
    const product = mapUnitToProduct({ unit: unit(), model, viewerId: "owner-1", recall: recall() });
    expect(product.safety).toBe("recalled");
    expect(product.owner).toBe("You");
    expect(product.lastAction).toBe("Urgent recall · Oct 9, 2026");
    expect(product.ownerSince).toBe("October 1, 2026");
  });

  it("falls back to the latest activity label without a recall", () => {
    const product = mapUnitToProduct({
      unit: unit(),
      model,
      viewerId: "other",
      ownerName: "Bob Chen",
      latestActivity: { kind: "transferred", created_at: "2026-10-08T00:00:00.000Z" },
    });
    expect(product.safety).toBe("clear");
    expect(product.owner).toBe("Bob Chen");
    expect(product.lastAction).toBe("Transferred · Oct 8, 2026");
  });

  it("formats dates for owner-facing copy", () => {
    expect(formatDateShort("2026-10-09T08:00:00.000Z")).toBe("Oct 9, 2026");
    expect(formatDateShort(null)).toBe("Unknown");
  });
});

describe("passport timeline", () => {
  it("orders registration, issuance, transfer, and recall events", () => {
    const entries = buildTimeline({
      unit: unit(),
      model,
      ownershipRecords: [
        {
          unit_id: "unit-1",
          from_profile_id: null,
          to_profile_id: "alice",
          transferred_at: "2026-10-02T00:00:00.000Z",
          note: null,
        },
        {
          unit_id: "unit-1",
          from_profile_id: "alice",
          to_profile_id: "bob",
          transferred_at: "2026-10-08T00:00:00.000Z",
          note: null,
        },
      ],
      profileNames: new Map([
        ["alice", "Alice Morgan"],
        ["bob", "Bob Chen"],
      ]),
      recall: recall(),
    });

    expect(entries.map((entry) => entry.title)).toEqual([
      "Registered",
      "Issued",
      "Transferred",
      "Recall issued",
    ]);
    expect(entries[2].detail).toBe("Ownership transferred to Bob Chen.");
    expect(entries[3].detail).toBe("Battery overheating risk applies.");
  });
});
