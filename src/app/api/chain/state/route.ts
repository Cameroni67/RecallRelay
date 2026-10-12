// GET /api/chain/state?unitId=... or ?manufacturerId=...
//
// Returns what the chain currently says, read server-side. Public information
// (PDAs and on-chain owner wallets are public by nature), but it requires a
// session so the endpoint cannot be used as a general cluster proxy.

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
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const url = new URL(request.url);
  const unitId = url.searchParams.get("unitId");
  const manufacturerId = url.searchParams.get("manufacturerId");

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
