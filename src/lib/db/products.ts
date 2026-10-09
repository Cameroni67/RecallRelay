import { getServerClient, type ServerSupabase } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/supabase/env";
import type { Product } from "@/lib/data";
import type { TimelineEntry } from "@/components/timeline";
import {
  buildTimeline,
  findRecallForUnit,
  mapUnitToProduct,
  mapVerificationToProduct,
  type ModelRow,
  type OwnershipRecordRow,
  type RecallScopeRow,
  type UnitRow,
} from "@/lib/db/mappers";
import { demoFindProduct, demoOwnedProducts, demoProducts, demoRecall, demoTimeline } from "@/lib/db/demo";

export function isDemoMode(): boolean {
  return !getPublicEnv().databaseConfigured;
}

type UnitWithModel = UnitRow & { product_models: ModelRow | null };

const UNIT_SELECT = `
  id, model_id, serial_number, registered_at, current_owner_profile_id,
  product_models ( id, sku, name, category, image_path, manufacturer_id, manufacturers ( name ) )
`;

type SupabaseError = { message: string };

function fail(error: SupabaseError): never {
  throw new Error(`RecallRelay database error: ${error.message}`);
}

async function fetchActiveRecalls(supabase: ServerSupabase): Promise<RecallScopeRow[]> {
  const { data, error } = await supabase
    .from("recalls")
    .select(
      "id, manufacturer_id, model_id, title, severity, required_action, scope_kind, serial_from, serial_to, issued_at, status, recall_units ( unit_id )",
    )
    .eq("status", "active");
  if (error) fail(error);
  return (data ?? []) as unknown as RecallScopeRow[];
}

async function fetchProfileNames(
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
    if (row.id) names.set(row.id, row.full_name ?? "Unknown");
  }
  return names;
}

async function fetchLatestActivity(
  supabase: ServerSupabase,
  unitIds: string[],
): Promise<Map<string, { kind: string; created_at: string }>> {
  const latest = new Map<string, { kind: string; created_at: string }>();
  if (!unitIds.length) return latest;
  const { data, error } = await supabase
    .from("activity_events")
    .select("unit_id, kind, created_at")
    .in("unit_id", unitIds)
    .order("created_at", { ascending: false });
  if (error) fail(error);
  for (const row of data ?? []) {
    if (row.unit_id && !latest.has(row.unit_id)) {
      latest.set(row.unit_id, { kind: row.kind, created_at: row.created_at });
    }
  }
  return latest;
}

async function fetchOwnershipRecords(
  supabase: ServerSupabase,
  unitIds: string[],
): Promise<OwnershipRecordRow[]> {
  if (!unitIds.length) return [];
  const { data, error } = await supabase
    .from("ownership_records")
    .select("unit_id, from_profile_id, to_profile_id, transferred_at, note")
    .in("unit_id", unitIds)
    .order("transferred_at", { ascending: true });
  if (error) fail(error);
  return (data ?? []) as OwnershipRecordRow[];
}

/** Product passports owned by the signed-in profile. */
export async function getOwnedProducts(viewerId: string | null): Promise<Product[]> {
  const supabase = await getServerClient();
  if (!supabase) return demoOwnedProducts;
  if (!viewerId) return [];

  const { data: units, error } = await supabase
    .from("product_units")
    .select(UNIT_SELECT)
    .eq("current_owner_profile_id", viewerId)
    .order("updated_at", { ascending: false });
  if (error) fail(error);

  const rows = (units ?? []) as unknown as UnitWithModel[];
  if (!rows.length) return [];

  const [recalls, activity] = await Promise.all([
    fetchActiveRecalls(supabase),
    fetchLatestActivity(supabase, rows.map((row) => row.id)),
  ]);

  return rows.map((unit) =>
    mapUnitToProduct({
      unit,
      model: unit.product_models,
      viewerId,
      recall: findRecallForUnit(unit, recalls),
      latestActivity: activity.get(unit.id) ?? null,
    }),
  );
}

/** Owner/manufacturer view: unit by uuid or serial number. */
export async function findProductByIdOrSerial(
  identifier: string,
  viewerId: string | null,
): Promise<Product | null> {
  const supabase = await getServerClient();
  if (!supabase) return demoFindProduct(identifier) ?? null;

  const decoded = decodeURIComponent(identifier);
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decoded);
  const query = supabase
    .from("product_units")
    .select(UNIT_SELECT)
    .eq(isUuid ? "id" : "serial_number", isUuid ? decoded : decoded.toUpperCase())
    .maybeSingle();

  const { data: unit, error } = await query;
  if (error) fail(error);
  if (!unit) return demoFindProduct(identifier) ?? null;

  const row = unit as unknown as UnitWithModel;
  const [recalls, activity, ownership] = await Promise.all([
    fetchActiveRecalls(supabase),
    fetchLatestActivity(supabase, [row.id]),
    fetchOwnershipRecords(supabase, [row.id]),
  ]);

  return mapUnitToProduct({
    unit: row,
    model: row.product_models,
    viewerId,
    recall: findRecallForUnit(row, recalls),
    latestActivity: activity.get(row.id) ?? null,
    latestOwnershipAt: ownership.at(-1)?.transferred_at ?? null,
  });
}

/** Public verification record (uuid or serial number). */
export async function getPublicProduct(identifier: string): Promise<Product | null> {
  const supabase = await getServerClient();
  if (!supabase) return demoFindProduct(identifier) ?? null;

  const { data, error } = await supabase.rpc("lookup_public_product", {
    p_identifier: decodeURIComponent(identifier),
  });
  if (error) fail(error);
  const row = data?.[0];
  if (!row) return null;
  return mapVerificationToProduct(row);
}

/** Passport timeline for a unit (ownership records + recalls). */
export async function getUnitTimeline(unitId: string): Promise<TimelineEntry[]> {
  const supabase = await getServerClient();
  if (!supabase) return demoTimeline;

  const { data: unit, error } = await supabase
    .from("product_units")
    .select(UNIT_SELECT)
    .eq("id", unitId)
    .maybeSingle();
  if (error) fail(error);
  if (!unit) return [];

  const row = unit as unknown as UnitWithModel;
  const [recalls, ownership] = await Promise.all([
    fetchActiveRecalls(supabase),
    fetchOwnershipRecords(supabase, [row.id]),
  ]);
  const names = await fetchProfileNames(
    supabase,
    ownership.flatMap((record) => [record.from_profile_id, record.to_profile_id]),
  );

  return buildTimeline({
    unit: row,
    model: row.product_models,
    ownershipRecords: ownership,
    profileNames: names,
    recall: findRecallForUnit(row, recalls),
  });
}

/** Manufacturer unit registry for one model. */
export async function listUnitsForModel(
  modelId: string,
  viewerId: string | null,
  demoSku?: string,
): Promise<Product[]> {
  const supabase = await getServerClient();
  if (!supabase) {
    return demoSku ? demoProducts.filter((product) => product.model === demoSku) : [];
  }

  const { data: units, error } = await supabase
    .from("product_units")
    .select(UNIT_SELECT)
    .eq("model_id", modelId)
    .order("registered_at", { ascending: false });
  if (error) fail(error);

  const rows = (units ?? []) as unknown as UnitWithModel[];
  if (!rows.length) return [];

  const [recalls, activity, ownerNames] = await Promise.all([
    fetchActiveRecalls(supabase),
    fetchLatestActivity(supabase, rows.map((unit) => unit.id)),
    fetchProfileNames(
      supabase,
      rows.map((unit) => unit.current_owner_profile_id),
    ),
  ]);

  return rows.map((unit) =>
    mapUnitToProduct({
      unit,
      model: unit.product_models,
      viewerId,
      ownerName: unit.current_owner_profile_id
        ? (ownerNames.get(unit.current_owner_profile_id) ?? null)
        : null,
      recall: findRecallForUnit(unit, recalls),
      latestActivity: activity.get(unit.id) ?? null,
    }),
  );
}

/** Owner-facing recalls: active recalls that affect units the viewer owns. */
export async function getOwnerRecalls(
  viewerId: string | null,
): Promise<{ product: Product; recall: RecallScopeRow }[]> {
  const supabase = await getServerClient();
  if (!supabase) {
    return demoOwnedProducts
      .filter((product) => product.safety === "recalled")
      .map((product) => ({ product, recall: demoRecall }));
  }
  if (!viewerId) return [];

  const { data: units, error } = await supabase
    .from("product_units")
    .select(UNIT_SELECT)
    .eq("current_owner_profile_id", viewerId);
  if (error) fail(error);

  const rows = (units ?? []) as unknown as UnitWithModel[];
  const recalls = await fetchActiveRecalls(supabase);
  const results: { product: Product; recall: RecallScopeRow }[] = [];

  for (const unit of rows) {
    const recall = findRecallForUnit(unit, recalls);
    if (!recall) continue;
    results.push({
      product: mapUnitToProduct({ unit, model: unit.product_models, viewerId, recall }),
      recall,
    });
  }
  return results;
}

/** Manufacturer recall list (RLS limits rows to active or own-workspace). */
export async function listManufacturerRecalls(
  manufacturerId: string | null,
): Promise<RecallScopeRow[]> {
  const supabase = await getServerClient();
  if (!supabase) return [];
  const query = supabase
    .from("recalls")
    .select(
      "id, manufacturer_id, model_id, title, severity, required_action, scope_kind, serial_from, serial_to, issued_at, status, recall_units ( unit_id )",
    )
    .order("issued_at", { ascending: false });
  const { data, error } = manufacturerId
    ? await query.eq("manufacturer_id", manufacturerId)
    : await query;
  if (error) fail(error);
  return (data ?? []) as unknown as RecallScopeRow[];
}

export async function findManufacturerRecall(
  recallId: string,
  manufacturerId: string | null,
): Promise<RecallScopeRow | null> {
  const supabase = await getServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("recalls")
    .select(
      "id, manufacturer_id, model_id, title, severity, required_action, scope_kind, serial_from, serial_to, issued_at, status, recall_units ( unit_id )",
    )
    .eq("id", recallId)
    .maybeSingle();
  if (error) fail(error);
  if (!data) return null;
  if (manufacturerId && data.manufacturer_id !== manufacturerId) return null;
  return data as unknown as RecallScopeRow;
}
