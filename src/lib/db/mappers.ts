import type { Product } from "@/lib/data";
import type { TimelineEntry } from "@/components/timeline";

export type VerificationRow = {
  unit_id: string | null;
  serial_number: string | null;
  model_id: string | null;
  model_sku: string | null;
  model_name: string | null;
  category: string | null;
  image_path: string | null;
  manufacturer_id: string | null;
  manufacturer_name: string | null;
  manufacturer_verified: boolean | null;
  is_recalled: boolean | null;
  recall_id: string | null;
  recall_title: string | null;
  recall_severity: string | null;
  recall_required_action: string | null;
  recall_issued_at: string | null;
};

export type RecallScopeRow = {
  id: string;
  manufacturer_id: string;
  model_id: string | null;
  title: string;
  severity: string;
  required_action: string;
  scope_kind: string;
  serial_from: string | null;
  serial_to: string | null;
  issued_at: string | null;
  status: string;
  recall_units?: { unit_id: string }[] | null;
};

export type UnitRow = {
  id: string;
  model_id: string;
  serial_number: string;
  registered_at: string;
  current_owner_profile_id: string | null;
};

export type ModelRow = {
  id: string;
  sku: string;
  name: string;
  category: string;
  image_path: string;
  manufacturer_id: string;
  manufacturers: { name: string } | { name: string }[] | null;
};

export type OwnershipRecordRow = {
  unit_id: string;
  from_profile_id: string | null;
  to_profile_id: string | null;
  transferred_at: string;
  note: string | null;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "October 8, 2026" — used for owner-since style copy. */
export function formatDateLong(iso: string | null | undefined): string {
  const date = parse(iso);
  if (!date) return "Unknown";
  return `${MONTHS_LONG[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

/** "Oct 7, 2026" — used for last-action style copy. */
export function formatDateShort(iso: string | null | undefined): string {
  const date = parse(iso);
  if (!date) return "Unknown";
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

/** "Oct 1" — used inside passport timelines. */
export function formatDateCompact(iso: string | null | undefined): string {
  const date = parse(iso);
  if (!date) return "Unknown";
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

function manufacturerName(model: ModelRow | null): string {
  if (!model) return "Unknown maker";
  const rel = model.manufacturers;
  if (Array.isArray(rel)) return rel[0]?.name ?? "Unknown maker";
  return rel?.name ?? "Unknown maker";
}

/** Mirrors public.active_recalls_for_unit() in Postgres. */
export function unitMatchesRecall(unit: UnitRow, recall: RecallScopeRow): boolean {
  if (recall.status !== "active") return false;
  if (recall.scope_kind === "all_units") return unit.model_id === recall.model_id;
  if (recall.scope_kind === "serial_range") {
    return (
      unit.model_id === recall.model_id &&
      Boolean(recall.serial_from && recall.serial_to) &&
      unit.serial_number >= (recall.serial_from as string) &&
      unit.serial_number <= (recall.serial_to as string)
    );
  }
  if (recall.scope_kind === "selected_units") {
    return (recall.recall_units ?? []).some((row) => row.unit_id === unit.id);
  }
  return false;
}

export function findRecallForUnit(
  unit: UnitRow,
  recalls: RecallScopeRow[],
): RecallScopeRow | null {
  const matches = recalls.filter((recall) => unitMatchesRecall(unit, recall));
  if (!matches.length) return null;
  matches.sort((a, b) => (b.issued_at ?? "").localeCompare(a.issued_at ?? ""));
  return matches[0];
}

export type MapUnitArgs = {
  unit: UnitRow;
  model: ModelRow | null;
  ownerName?: string | null;
  viewerId?: string | null;
  recall?: RecallScopeRow | null;
  latestActivity?: { kind: string; created_at: string } | null;
  latestOwnershipAt?: string | null;
};

export function mapUnitToProduct(args: MapUnitArgs): Product {
  const { unit, model, ownerName, viewerId, recall, latestActivity, latestOwnershipAt } = args;
  const ownedByViewer = Boolean(viewerId && unit.current_owner_profile_id === viewerId);

  let safety: Product["safety"] = "clear";
  if (recall) safety = "recalled";

  let lastAction = "No active recalls";
  if (recall) {
    lastAction = `${recall.severity === "urgent" ? "Urgent recall" : "Recall issued"} · ${formatDateShort(recall.issued_at)}`;
  } else if (latestActivity) {
    const label =
      latestActivity.kind === "transferred"
        ? "Transferred"
        : latestActivity.kind === "registered"
          ? "Registered"
          : "Updated";
    lastAction = `${label} · ${formatDateShort(latestActivity.created_at)}`;
  }

  return {
    id: unit.id,
    maker: manufacturerName(model),
    name: model?.name ?? "Unknown product",
    category: model?.category ?? "Product",
    model: model?.sku ?? "",
    serial: unit.serial_number,
    image: model?.image_path ?? "/products/heatcore.svg",
    owner: ownedByViewer ? "You" : (ownerName ?? "Unowned"),
    ownerSince: formatDateLong(latestOwnershipAt ?? unit.registered_at),
    safety,
    lastAction,
  };
}

export type TimelineArgs = {
  unit: UnitRow;
  model: ModelRow | null;
  ownershipRecords: OwnershipRecordRow[];
  profileNames: Map<string, string>;
  recall?: RecallScopeRow | null;
  registeredAt?: string | null;
};

/** Builds the passport timeline in chronological order. */
export function buildTimeline(args: TimelineArgs): TimelineEntry[] {
  const { unit, model, ownershipRecords, profileNames, recall, registeredAt } = args;
  const maker = manufacturerName(model);
  const entries: { at: string; entry: TimelineEntry }[] = [];

  const records = [...ownershipRecords].sort((a, b) =>
    a.transferred_at.localeCompare(b.transferred_at),
  );

  const registered = records.find((record) => record.from_profile_id === null);
  const registeredAtIso = registered?.transferred_at ?? registeredAt ?? unit.registered_at;
  entries.push({
    at: registeredAtIso,
    entry: {
      title: "Registered",
      date: formatDateCompact(registeredAtIso),
      detail: `Registered by ${maker}.`,
    },
  });

  const firstOwner = records.find(
    (record) => record.from_profile_id === null && record.to_profile_id !== null,
  );
  if (firstOwner) {
    const name = firstOwner.to_profile_id
      ? (profileNames.get(firstOwner.to_profile_id) ?? "Unknown owner")
      : "Unknown owner";
    entries.push({
      at: firstOwner.transferred_at,
      entry: {
        title: "Issued",
        date: formatDateCompact(firstOwner.transferred_at),
        detail: `First owner: ${name}.`,
      },
    });
  }

  records
    .filter((record) => record.from_profile_id !== null)
    .forEach((record) => {
      const name = record.to_profile_id
        ? (profileNames.get(record.to_profile_id) ?? "Unknown owner")
        : "Unknown owner";
      entries.push({
        at: record.transferred_at,
        entry: {
          title: "Transferred",
          date: formatDateCompact(record.transferred_at),
          detail: `Ownership transferred to ${name}.`,
        },
      });
    });

  if (recall) {
    entries.push({
      at: recall.issued_at ?? new Date().toISOString(),
      entry: {
        title: "Recall issued",
        date: formatDateCompact(recall.issued_at),
        detail: `${recall.title} applies.`,
      },
    });
  }

  return entries.sort((a, b) => a.at.localeCompare(b.at)).map((item) => item.entry);
}

/** Maps a v_public_product_verification row onto the Phase 1 Product shape. */
export function mapVerificationToProduct(row: VerificationRow): Product {
  const recalled = Boolean(row.is_recalled);
  return {
    id: row.unit_id ?? "",
    maker: row.manufacturer_name ?? "Unknown maker",
    name: row.model_name ?? "Unknown product",
    category: row.category ?? "Product",
    model: row.model_sku ?? "",
    serial: row.serial_number ?? "",
    image: row.image_path ?? "/products/heatcore.svg",
    owner: "Verified",
    ownerSince: "",
    safety: recalled ? "recalled" : "clear",
    lastAction: recalled
      ? `Urgent recall · ${formatDateShort(row.recall_issued_at)}`
      : "No active recalls",
  };
}
