// POST /api/chain/reconcile
//
// Reconciles an observed on-chain ownership transfer into the database. The
// request carries only the unit id and the transaction signature the client
// claims happened; every chain value (owner, transfer count) is read
// server-side from the cluster. Manufacturer/product re-verification lives at
// POST /api/manufacturers/[id]/reconcile-chain and
// POST /api/products/[id]/reconcile-chain.

import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/supabase/env";
import { reconcileTransfer } from "@/lib/chain/reconcile";

export const dynamic = "force-dynamic";

type Body = {
  kind?: string;
  unitId?: string;
  txSignature?: string;
};

export async function POST(request: Request) {
  if (!getPublicEnv().databaseConfigured) {
    return NextResponse.json({ error: "Demo data mode: no chain to reconcile." }, { status: 400 });
  }
  const supabase = await getServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.unitId) {
    return NextResponse.json({ error: "unitId is required." }, { status: 400 });
  }
  if (!body.txSignature) {
    return NextResponse.json({ error: "txSignature is required." }, { status: 400 });
  }

  // Resolve the unit's manufacturer so the PDA can be derived server-side.
  const { data: unit } = await supabase
    .from("product_units")
    .select("id, model_id, product_models ( manufacturer_id )")
    .eq("id", body.unitId)
    .maybeSingle();
  if (!unit) {
    return NextResponse.json({ error: "unknown product unit" }, { status: 404 });
  }
  const rel = (unit as { product_models: { manufacturer_id: string } | null }).product_models;
  const manufacturerId = Array.isArray(rel) ? rel[0]?.manufacturer_id : rel?.manufacturer_id;
  if (!manufacturerId) {
    return NextResponse.json({ error: "Unit has no manufacturer." }, { status: 409 });
  }

  const result = await reconcileTransfer(
    supabase,
    body.unitId,
    manufacturerId,
    body.txSignature,
  );
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
