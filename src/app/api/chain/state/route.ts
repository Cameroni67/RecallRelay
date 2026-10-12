// GET /api/chain/state?unitId=... or ?manufacturerId=...
//
// Returns what the chain currently says, read server-side. Public information
// (PDAs and on-chain owner wallets are public by nature). Signed-in users may
// read any unit or their manufacturer; a session-free read is allowed for a
// SINGLE unit only (no owner wallet in the response) so the public
// verification page has a controlled retry path without turning this into a
// general cluster proxy.

import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/supabase/env";
import { observeManufacturer, observeProduct, getConnection } from "@/lib/solana/chain";
import { PROGRAM_ID } from "@/lib/solana/deployment";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!getPublicEnv().databaseConfigured) {
    return NextResponse.json({ error: "Demo data mode: no chain to read." }, { status: 400 });
  }
  const supabase = await getServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Not available." }, { status: 401 });
  }

  const url = new URL(request.url);
  const unitId = url.searchParams.get("unitId");
  const manufacturerId = url.searchParams.get("manufacturerId");

  const { data: userData } = await supabase.auth.getUser();
  const hasSession = Boolean(userData?.user);
  const publicUnitRead = !hasSession && !manufacturerId && Boolean(unitId);
  if (!hasSession && !publicUnitRead) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  if (manufacturerId && !unitId) {
    const observed = await observeManufacturer(manufacturerId);
    return NextResponse.json({
      kind: "manufacturer",
      programId: PROGRAM_ID,
      registered: Boolean(observed),
      pda: observed?.pda ?? null,
      authority: observed?.authority ?? null,
      isActive: observed?.isActive ?? null,
    });
  }

  if (!unitId) {
    return NextResponse.json({ error: "unitId or manufacturerId is required." }, { status: 400 });
  }

  if (publicUnitRead) {
    // Session-free path: resolve the unit through the public lookup (anon
    // grant, security definer) and return chain state WITHOUT the owner
    // wallet. Session-free callers can retry a flaky chain read but can
    // never enumerate units or read profiles.
    const { data: rows, error: lookupError } = await supabase.rpc("lookup_public_product", {
      p_identifier: unitId,
    });
    if (lookupError || !rows?.[0]) {
      return NextResponse.json({ error: "unknown product unit" }, { status: 404 });
    }
    const row = rows[0] as { unit_id: string; manufacturer_id: string };
    const observed = await observeProduct(row.unit_id, row.manufacturer_id);
    let slot: number | null = null;
    try {
      slot = await getConnection().getSlot("confirmed");
    } catch {
      slot = null;
    }
    return NextResponse.json({
      kind: "product",
      programId: PROGRAM_ID,
      clusterSlot: slot,
      registered: Boolean(observed),
      pda: observed?.pda ?? null,
      transferCount: observed?.transferCount ?? null,
      isActive: observed?.isActive ?? null,
    });
  }

  const { data: unit } = await supabase
    .from("product_units")
    .select("id, model_id, product_models ( manufacturer_id )")
    .eq("id", unitId)
    .maybeSingle();
  if (!unit) {
    return NextResponse.json({ error: "unknown product unit" }, { status: 404 });
  }
  const rel = (unit as { product_models: { manufacturer_id: string } | null }).product_models;
  const manufacturer = Array.isArray(rel) ? rel[0]?.manufacturer_id : rel?.manufacturer_id;
  if (!manufacturer) {
    return NextResponse.json({ error: "Unit has no manufacturer." }, { status: 409 });
  }

  const observed = await observeProduct(unitId, manufacturer);
  let slot: number | null = null;
  try {
    slot = await getConnection().getSlot("confirmed");
  } catch {
    slot = null;
  }
  return NextResponse.json({
    kind: "product",
    programId: PROGRAM_ID,
    clusterSlot: slot,
    registered: Boolean(observed),
    pda: observed?.pda ?? null,
    currentOwner: observed?.currentOwner ?? null,
    transferCount: observed?.transferCount ?? null,
    isActive: observed?.isActive ?? null,
  });
}
