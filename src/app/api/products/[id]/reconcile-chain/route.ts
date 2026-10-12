// POST /api/products/[id]/reconcile-chain
//
// Re-reads this unit's on-chain product account directly from Solana and
// records what the server observed through the trusted SECURITY DEFINER RPC.
// The request carries no chain state — only the identifier in the path and,
// optionally, a transaction signature the client claims happened (which the
// server verifies against the cluster before storing).

import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/supabase/env";
import { reconcileProduct } from "@/lib/chain/reconcile";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!getPublicEnv().databaseConfigured) {
    return NextResponse.json(
      { error: "Demo data mode: no chain to reconcile." },
      { status: 400 },
    );
  }
  const supabase = await getServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Product unit id is required." }, { status: 400 });
  }

  let txSignature: string | null = null;
  try {
    const body = (await request.json()) as { txSignature?: string };
    txSignature = body?.txSignature ?? null;
  } catch {
    // An empty body is fine — plain re-verification carries no signature.
  }

  // Resolve the unit's manufacturer so the PDA can be derived server-side.
  const { data: unit } = await supabase
    .from("product_units")
    .select("id, model_id, product_models ( manufacturer_id )")
    .eq("id", id)
    .maybeSingle();
  if (!unit) {
    return NextResponse.json({ error: "unknown product unit" }, { status: 404 });
  }
  const rel = (unit as { product_models: { manufacturer_id: string } | null }).product_models;
  const manufacturerId = Array.isArray(rel) ? rel[0]?.manufacturer_id : rel?.manufacturer_id;
  if (!manufacturerId) {
    return NextResponse.json({ error: "Unit has no manufacturer." }, { status: 409 });
  }

  const result = await reconcileProduct(supabase, id, manufacturerId, txSignature);
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
