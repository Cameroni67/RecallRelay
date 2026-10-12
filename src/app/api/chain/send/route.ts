// POST /api/chain/send
//
// Submits a wallet-signed transaction to the cluster and waits for it to be
// confirmed. The server never signed anything — it only relays bytes the
// wallet already approved, then reports the resulting signature. Recording
// still happens separately via /api/chain/reconcile, which re-reads the
// chain; this route's confirmation result is a UX convenience, not authority.

import { NextResponse } from "next/server";
import { VersionedTransaction } from "@solana/web3.js";
import { getServerClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/supabase/env";
import { getConnection } from "@/lib/solana/chain";

export const dynamic = "force-dynamic";

type Body = { transaction?: string };

export async function POST(request: Request) {
  if (!getPublicEnv().databaseConfigured) {
    return NextResponse.json({ error: "Demo data mode: no chain to send to." }, { status: 400 });
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
  if (!body.transaction) {
    return NextResponse.json({ error: "transaction is required." }, { status: 400 });
  }

  let tx: VersionedTransaction;
  try {
    tx = VersionedTransaction.deserialize(
      Uint8Array.from(atob(body.transaction), (c) => c.charCodeAt(0)),
    );
  } catch {
    return NextResponse.json({ error: "Malformed transaction bytes." }, { status: 400 });
  }

  const connection = getConnection();
  try {
    const signature = await connection.sendTransaction(tx, {
      skipPreflight: false,
      maxRetries: 3,
    });
    const latest = await connection.getLatestBlockhash("confirmed");
    const confirmation = await connection.confirmTransaction(
      { signature, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
      "confirmed",
    );
    if (confirmation.value.err) {
      return NextResponse.json(
        { ok: false, error: `Transaction failed on chain: ${JSON.stringify(confirmation.value.err)}` },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: true, signature });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 409 });
  }
}
