import { getServerClient, type ServerSupabase } from "@/lib/supabase/server";
import type { Product } from "@/lib/data";
import { demoOwnedProducts } from "@/lib/db/demo";

function fail(error: { message: string }): never {
  throw new Error(`RecallRelay database error: ${error.message}`);
}

export type TransferDraft = {
  unitId: string;
  recipientWallet: string;
  note?: string | null;
};

export type TransferPreview = {
  id: string;
  full_name: string;
  wallet_masked: string;
  is_self: boolean;
};

/** Resolves a recipient wallet via the find_profile_by_wallet RPC. */
export async function findRecipient(wallet: string): Promise<TransferPreview | null> {
  const supabase = await getServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("find_profile_by_wallet", {
    p_wallet: wallet.trim(),
  });
  if (error) fail(error);
  const row = Array.isArray(data) ? data[0] : (data as TransferPreview | null);
  if (!row) return null;
  return row;
}

/** Executes the transfer_product_ownership RPC. Throws with a friendly message on failure. */
export async function transferOwnership(
  draft: TransferDraft,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await getServerClient();
  if (!supabase) return { ok: true };
  const { error } = await supabase.rpc("transfer_product_ownership", {
    p_unit_id: draft.unitId,
    p_recipient_wallet: draft.recipientWallet.trim(),
    p_note: draft.note ?? undefined,
  });
  if (error) return { ok: false, error: friendlyTransferError(error.message) };
  return { ok: true };
}

function friendlyTransferError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("no recallrelay profile for that wallet")) return "Recipient wallet not found.";
  if (lower.includes("only the current owner")) return "Only the current owner can transfer this product.";
  if (lower.includes("cannot transfer to yourself")) return "That wallet is already the owner.";
  if (lower.includes("unknown product unit")) return "That product no longer exists.";
  return "Transfer failed. Please try again.";
}

export type TransferHistoryEntry = {
  id: string;
  transferredAt: string;
  note: string | null;
  direction: "to" | "from";
  product: Product;
  counterparty: string;
};

/** Recent transfers for the owner (ownership records where the viewer is a party). */
export async function getTransferHistory(viewerId: string | null): Promise<TransferHistoryEntry[]> {
  const supabase = await getServerClient();
  if (!supabase) {
    return demoOwnedProducts.slice(0, 3).map((product, index) => ({
      id: `demo-transfer-${index}`,
      transferredAt: product.ownerSince,
      note: null,
      direction: index === 1 ? "to" : "from",
      product,
      counterparty: index === 1 ? "Maya Ortiz" : "Bob Chen",
    }));
  }
  if (!viewerId) return [];

  const { data, error } = await supabase
    .from("ownership_records")
    .select(
      "id, unit_id, from_profile_id, to_profile_id, transferred_at, note, product_units ( id, serial_number, current_owner_profile_id, product_models ( id, sku, name, category, image_path, manufacturer_id, manufacturers ( name ) ) )",
    )
    .order("transferred_at", { ascending: false })
    .limit(30);
  if (error) fail(error);

  const rows = (data ?? []) as unknown as TransferRecordRow[];
  const names = await fetchNames(
    supabase,
    rows.flatMap((row) => [row.from_profile_id, row.to_profile_id]),
  );

  const entries: TransferHistoryEntry[] = [];
  for (const row of rows) {
    const unit = row.product_units;
    if (!unit) continue;
    const direction: "to" | "from" =
      row.to_profile_id === viewerId ? "to" : "from";
    const counterpartyId = direction === "to" ? row.from_profile_id : row.to_profile_id;
    entries.push({
      id: row.id,
      transferredAt: row.transferred_at,
      note: row.note,
      direction,
      counterparty: counterpartyId
        ? (names.get(counterpartyId) ?? "Unknown owner")
        : "Unassigned",
      product: {
        id: unit.id,
        maker: unit.product_models?.manufacturers
          ? (Array.isArray(unit.product_models.manufacturers)
              ? unit.product_models.manufacturers[0]?.name
              : unit.product_models.manufacturers.name) ?? "Unknown maker"
          : "Unknown maker",
        name: unit.product_models?.name ?? "Unknown product",
        category: unit.product_models?.category ?? "Product",
        model: unit.product_models?.sku ?? "",
        serial: unit.serial_number,
        image: unit.product_models?.image_path ?? "/products/heatcore.svg",
        owner: direction === "to" ? "You" : "Transferred",
        ownerSince: row.transferred_at,
        safety: "clear",
        lastAction: "Transferred",
      },
    });
  }
  return entries;
}

type TransferRecordRow = {
  id: string;
  unit_id: string;
  from_profile_id: string | null;
  to_profile_id: string | null;
  transferred_at: string;
  note: string | null;
  product_units: {
    id: string;
    serial_number: string;
    current_owner_profile_id: string | null;
    product_models: {
      id: string;
      sku: string;
      name: string;
      category: string;
      image_path: string;
      manufacturer_id: string;
      manufacturers: { name: string } | { name: string }[] | null;
    } | null;
  } | null;
};

async function fetchNames(
  supabase: ServerSupabase,
  ids: (string | null)[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  const names = new Map<string, string>();
  if (!unique.length) return names;
  const { data, error } = await supabase
    .from("v_shared_profiles")
    .select("id, full_name")
    .in("id", unique);
  if (error) fail(error);
  for (const row of data ?? []) {
    if (row.id) names.set(row.id, row.full_name ?? "Unknown owner");
  }
  return names;
}

