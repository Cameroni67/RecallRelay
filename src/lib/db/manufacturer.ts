import { getServerClient, type ServerSupabase } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { demoModels, demoStats } from "@/lib/db/demo";

type ModelRow = Database["public"]["Tables"]["product_models"]["Row"];

function fail(error: { message: string }): never {
  throw new Error(`RecallRelay database error: ${error.message}`);
}

export type ManufacturerModel = {
  id: string;
  name: string;
  category: string;
  units: number;
  safety: string;
  image: string;
};

export type ManufacturerStats = {
  registeredUnits: number;
  activeRecalls: number;
  ownersReached: number;
  modelCount: number;
};

export async function listModels(manufacturerId: string | null): Promise<ManufacturerModel[]> {
  const supabase = await getServerClient();
  if (!supabase) return demoModels;
  if (!manufacturerId) return [];

  const { data: models, error } = await supabase
    .from("product_models")
    .select("id, sku, name, category, image_path")
    .order("created_at", { ascending: true });
  if (error) fail(error);

  const rows = models ?? [];
  const counts = await Promise.all(
    rows.map(async (model) => {
      const { count, error: countError } = await supabase
        .from("product_units")
        .select("id", { count: "exact", head: true })
        .eq("model_id", model.id);
      if (countError) fail(countError);
      return count ?? 0;
    }),
  );

  const recalls = await listActiveRecallSeverities(supabase);

  return rows.map((model, index) => ({
    id: model.sku,
    name: model.name,
    category: model.category,
    units: counts[index],
    safety: recalls.has(model.id) ? "1 active recall" : "No active recalls",
    image: model.image_path,
  }));
}

async function listActiveRecallSeverities(
  supabase: ServerSupabase,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("recalls")
    .select("model_id")
    .eq("status", "active");
  if (error) fail(error);
  return new Set(
    (data ?? [])
      .map((row) => row.model_id)
      .filter((value): value is string => Boolean(value)),
  );
}

export async function getModelBySku(sku: string): Promise<ModelRow | null> {
  const supabase = await getServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("product_models")
    .select("*")
    .eq("sku", sku.toUpperCase())
    .maybeSingle();
  if (error) fail(error);
  return data;
}

export async function getModelById(modelId: string): Promise<ModelRow | null> {
  const supabase = await getServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("product_models")
    .select("*")
    .eq("id", modelId)
    .maybeSingle();
  if (error) fail(error);
  return data;
}

export type ModelOption = {
  id: string;
  name: string;
  sku: string;
  category: string;
  image: string;
};

/** Model choices for client flows (uuid id for RPCs, sku for display). */
export async function listModelOptions(manufacturerId: string | null): Promise<ModelOption[]> {
  const supabase = await getServerClient();
  if (!supabase) {
    return demoModels.map((model) => ({
      id: model.id,
      name: model.name,
      sku: model.id,
      category: model.category,
      image: model.image,
    }));
  }
  if (!manufacturerId) return [];
  const { data, error } = await supabase
    .from("product_models")
    .select("id, sku, name, category, image_path")
    .order("created_at", { ascending: true });
  if (error) fail(error);
  return (data ?? []).map((model) => ({
    id: model.id,
    name: model.name,
    sku: model.sku,
    category: model.category,
    image: model.image_path,
  }));
}

/** Affected-unit and owner counts for a recall (authenticated RPCs). */
export async function getRecallCounts(
  recallId: string,
): Promise<{ affectedUnits: number; ownersReached: number }> {
  const supabase = await getServerClient();
  if (!supabase) return { affectedUnits: 127, ownersReached: 127 };
  const [units, owners] = await Promise.all([
    supabase.rpc("recall_affected_unit_count", { p_recall_id: recallId }),
    supabase.rpc("recall_affected_owner_ids", { p_recall_id: recallId }),
  ]);
  if (units.error) fail(units.error);
  if (owners.error) fail(owners.error);
  return {
    affectedUnits: Number(units.data ?? 0),
    ownersReached: Array.isArray(owners.data) ? owners.data.length : 0,
  };
}

export async function getManufacturerStats(
  manufacturerId: string | null,
): Promise<ManufacturerStats> {
  const supabase = await getServerClient();
  if (!supabase) return demoStats;
  if (!manufacturerId) {
    return { registeredUnits: 0, activeRecalls: 0, ownersReached: 0, modelCount: 0 };
  }

  const [unitsResult, recallsResult, modelsResult] = await Promise.all([
    supabase.from("product_units").select("id", { count: "exact", head: true }),
    supabase.from("recalls").select("id").eq("status", "active"),
    supabase.from("product_models").select("id", { count: "exact", head: true }),
  ]);
  if (unitsResult.error) fail(unitsResult.error);
  if (recallsResult.error) fail(recallsResult.error);
  if (modelsResult.error) fail(modelsResult.error);

  const owners = await supabase
    .from("ownership_records")
    .select("to_profile_id")
    .not("to_profile_id", "is", null);
  if (owners.error) fail(owners.error);
  const uniqueOwners = new Set(
    (owners.data ?? []).map((row) => row.to_profile_id).filter(Boolean),
  );

  return {
    registeredUnits: unitsResult.count ?? 0,
    activeRecalls: recallsResult.data?.length ?? 0,
    ownersReached: uniqueOwners.size,
    modelCount: modelsResult.count ?? 0,
  };
}

/** create_product_model RPC wrapper. */
export async function createModel(input: {
  manufacturerId: string;
  sku: string;
  name: string;
  category: string;
  imagePath?: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await getServerClient();
  if (!supabase) return { ok: true, id: input.sku };
  const { data, error } = await supabase.rpc("create_product_model", {
    p_manufacturer_id: input.manufacturerId,
    p_sku: input.sku,
    p_name: input.name,
    p_category: input.category,
    p_image_path: input.imagePath ?? "/products/heatcore.svg",
  });
  if (error) return { ok: false, error: friendlyModelError(error.message) };
  return { ok: true, id: String(data ?? input.sku) };
}

function friendlyModelError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("already exists")) return "That SKU already exists.";
  if (lower.includes("not a member")) return "You need manufacturer access to add models.";
  return "Could not create the model. Please try again.";
}

/** issue_recall RPC wrapper. */
export async function issueRecall(input: {
  manufacturerId: string;
  modelId: string;
  title: string;
  requiredAction: string;
  severity: string;
  scope:
    | { kind: "all_units" }
    | { kind: "serial_range"; from: string; to: string }
    | { kind: "selected_units"; unitIds: string[] };
}): Promise<{ ok: true; id: string; affectedUnits: number } | { ok: false; error: string }> {
  const supabase = await getServerClient();
  if (!supabase) return { ok: true, id: "demo-recall", affectedUnits: 127 };

  const { data, error } = await supabase.rpc("issue_recall", {
    p_manufacturer_id: input.manufacturerId,
    p_model_id: input.modelId,
    p_title: input.title,
    p_required_action: input.requiredAction,
    p_severity: input.severity,
    p_scope_kind: input.scope.kind,
    p_serial_from: input.scope.kind === "serial_range" ? input.scope.from : undefined,
    p_serial_to: input.scope.kind === "serial_range" ? input.scope.to : undefined,
    p_unit_ids:
      input.scope.kind === "selected_units" ? input.scope.unitIds : undefined,
  });
  if (error) return { ok: false, error: friendlyRecallError(error.message) };
  const payload = data as { id?: string; affected_units?: number } | string | null;
  if (typeof payload === "string") {
    return { ok: true, id: payload, affectedUnits: 0 };
  }
  return {
    ok: true,
    id: payload?.id ?? "",
    affectedUnits: payload?.affected_units ?? 0,
  };
}

function friendlyRecallError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("only manufacturer owners or admins")) return "You need manufacturer owner access to issue recalls.";
  if (lower.includes("does not belong")) return "That model belongs to another manufacturer.";
  if (lower.includes("requires unit ids")) return "Select at least one unit for this scope.";
  if (lower.includes("invalid scope")) return "Select a valid recall scope.";
  if (lower.includes("invalid severity")) return "Select a valid severity.";
  if (lower.includes("is not eligible")) return "One of the selected units is not eligible for this recall.";
  return "Could not issue the recall. Please try again.";
}

/** Resolves serial numbers to unit ids for selected_units recall scope. */
export async function lookupUnitIds(
  modelId: string,
  serials: string[],
): Promise<{ unitIds: string[]; missing: string[] }> {
  const supabase = await getServerClient();
  if (!supabase) return { unitIds: serials, missing: [] };
  const trimmed = serials.map((serial) => serial.trim()).filter(Boolean);
  if (!trimmed.length) return { unitIds: [], missing: [] };

  const { data, error } = await supabase
    .from("product_units")
    .select("id, serial_number")
    .eq("model_id", modelId)
    .in("serial_number", trimmed);
  if (error) fail(error);

  const found = new Map((data ?? []).map((row) => [row.serial_number, row.id]));
  const unitIds = trimmed.filter((serial) => found.has(serial)).map((serial) => found.get(serial)!);
  const missing = trimmed.filter((serial) => !found.has(serial));
  return { unitIds, missing };
}

export type UnitOption = { id: string; serialNumber: string; ownerName: string | null; modelId: string };

async function hydrateUnits(
  supabase: ServerSupabase,
  rows: { id: string; serial_number: string; model_id: string; current_owner_profile_id: string | null }[],
): Promise<UnitOption[]> {
  const ids = [
    ...new Set(
      rows
        .map((row) => row.current_owner_profile_id)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: profiles, error: profileError } = await supabase
      .from("v_shared_profiles")
      .select("id, full_name")
      .in("id", ids);
    if (profileError) fail(profileError);
    for (const row of profiles ?? []) {
      if (row.id) names.set(row.id, row.full_name ?? "Unknown owner");
    }
  }
  return rows.map((row) => ({
    id: row.id,
    serialNumber: row.serial_number,
    modelId: row.model_id,
    ownerName: row.current_owner_profile_id
      ? (names.get(row.current_owner_profile_id) ?? null)
      : null,
  }));
}

/** Every unit visible to the signed-in manufacturer member (RLS scoped). */
export async function listAllUnits(): Promise<UnitOption[]> {
  const supabase = await getServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("product_units")
    .select("id, serial_number, model_id, current_owner_profile_id")
    .order("serial_number", { ascending: true });
  if (error) fail(error);
  return hydrateUnits(supabase, data ?? []);
}

export async function listUnitsForScope(modelId: string): Promise<UnitOption[]> {
  const supabase = await getServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("product_units")
    .select("id, serial_number, model_id, current_owner_profile_id")
    .eq("model_id", modelId)
    .order("serial_number", { ascending: true });
  if (error) fail(error);
  return hydrateUnits(supabase, data ?? []);
}
