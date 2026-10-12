// POST /api/manufacturers/[id]/reconcile-chain
//
// Re-reads this manufacturer's on-chain account directly from Solana and
// records what the server observed through the trusted SECURITY DEFINER RPC.
// The request carries no chain state — only the identifier in the path.

import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/supabase/env";
import { reconcileManufacturer } from "@/lib/chain/reconcile";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
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
    return NextResponse.json({ error: "Manufacturer id is required." }, { status: 400 });
  }

  const result = await reconcileManufacturer(supabase, id);
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
