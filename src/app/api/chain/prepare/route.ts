// POST /api/chain/prepare
//
// Builds an unsigned RecallRelay instruction for the client's wallet to sign.
// The server decides the PDA and the accounts; the wallet only signs what the
// server prepared. Nothing here writes to the database — recording happens
// later via /api/chain/reconcile after the transaction is confirmed.

import { NextResponse } from "next/server";
import { PublicKey, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { getServerClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/supabase/env";
import { getConnection, hashIdentifier, manufacturerPdaFor, productPdaFor } from "@/lib/solana/chain";
import { PROGRAM_ID } from "@/lib/solana/deployment";

export const dynamic = "force-dynamic";

const SYSTEM_PROGRAM = new PublicKey("11111111111111111111111111111111");

type Body = {
  action?: "initialize-manufacturer" | "register-product" | "transfer-product";
  manufacturerId?: string;
  unitId?: string;
  authority?: string;
  ownerWallet?: string;
  newOwnerWallet?: string;
};

export async function POST(request: Request) {
  if (!getPublicEnv().databaseConfigured) {
    return NextResponse.json({ error: "Demo data mode: no chain to prepare." }, { status: 400 });
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

  const programId = new PublicKey(PROGRAM_ID);
  const connection = getConnection();

  const loadUnit = async (unitId: string) => {
    const { data: unit } = await supabase
      .from("product_units")
      .select("id, model_id, product_models ( manufacturer_id )")
      .eq("id", unitId)
      .maybeSingle();
    if (!unit) return null;
    const rel = (unit as { product_models: { manufacturer_id: string } | null }).product_models;
    const manufacturer = Array.isArray(rel) ? rel[0]?.manufacturer_id : rel?.manufacturer_id;
    return manufacturer ? { unitId, manufacturerId: manufacturer } : null;
  };

  if (body.action === "initialize-manufacturer") {
    if (!body.manufacturerId || !body.authority) {
      return NextResponse.json(
        { error: "manufacturerId and authority are required." },
        { status: 400 },
      );
    }
    const uuidHash = hashIdentifier(body.manufacturerId);
    const pda = manufacturerPdaFor(uuidHash, programId);
    const authority = new PublicKey(body.authority);
    const ix = {
      programId,
      keys: [
        { pubkey: pda, isSigner: false, isWritable: true },
        { pubkey: authority, isSigner: true, isWritable: false },
        { pubkey: SYSTEM_PROGRAM, isSigner: false, isWritable: false },
      ],
      data: Buffer.concat([Buffer.from([0]), Buffer.from(uuidHash)]),
    };
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    const message = new TransactionMessage({
      payerKey: authority,
      recentBlockhash: blockhash,
      instructions: [ix],
    }).compileToV0Message();
    const tx = new VersionedTransaction(message);
    return NextResponse.json({
      action: body.action,
      pda: pda.toBase58(),
      blockhash,
      transaction: Buffer.from(tx.serialize()).toString("base64"),
    });
  }

  if (body.action === "register-product") {
    if (!body.unitId || !body.authority || !body.ownerWallet) {
      return NextResponse.json(
        { error: "unitId, authority and ownerWallet are required." },
        { status: 400 },
      );
    }
    const loaded = await loadUnit(body.unitId);
    if (!loaded) return NextResponse.json({ error: "unknown product unit" }, { status: 404 });
    const manufacturerHash = hashIdentifier(loaded.manufacturerId);
    const manufacturerPda = manufacturerPdaFor(manufacturerHash, programId);
    const uuidHash = hashIdentifier(loaded.unitId);
    const productPda = productPdaFor(uuidHash, manufacturerPda, programId);
    const authority = new PublicKey(body.authority);
    const owner = new PublicKey(body.ownerWallet);
    const ix = {
      programId,
      keys: [
        { pubkey: productPda, isSigner: false, isWritable: true },
        { pubkey: manufacturerPda, isSigner: false, isWritable: false },
        { pubkey: authority, isSigner: true, isWritable: false },
        { pubkey: owner, isSigner: false, isWritable: false },
        { pubkey: SYSTEM_PROGRAM, isSigner: false, isWritable: false },
      ],
      data: Buffer.concat([Buffer.from([1]), Buffer.from(uuidHash)]),
    };
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    const message = new TransactionMessage({
      payerKey: authority,
      recentBlockhash: blockhash,
      instructions: [ix],
    }).compileToV0Message();
    const tx = new VersionedTransaction(message);
    return NextResponse.json({
      action: body.action,
      pda: productPda.toBase58(),
      blockhash,
      transaction: Buffer.from(tx.serialize()).toString("base64"),
    });
  }

  if (body.action === "transfer-product") {
    if (!body.unitId || !body.newOwnerWallet) {
      return NextResponse.json(
        { error: "unitId and newOwnerWallet are required." },
        { status: 400 },
      );
    }
    const loaded = await loadUnit(body.unitId);
    if (!loaded) return NextResponse.json({ error: "unknown product unit" }, { status: 404 });
    const manufacturerHash = hashIdentifier(loaded.manufacturerId);
    const manufacturerPda = manufacturerPdaFor(manufacturerHash, programId);
    const uuidHash = hashIdentifier(loaded.unitId);
    const productPda = productPdaFor(uuidHash, manufacturerPda, programId);
    const { data: unitRow } = await supabase
      .from("product_units")
      .select("current_owner_profile_id, profiles ( wallet_address )")
      .eq("id", loaded.unitId)
      .maybeSingle();
    const rel = (unitRow as { profiles: { wallet_address: string | null } | null } | null)?.profiles;
    const ownerWallet = Array.isArray(rel) ? rel[0]?.wallet_address : rel?.wallet_address;
    if (!ownerWallet) {
      return NextResponse.json(
        { error: "The current owner profile has no wallet address on file." },
        { status: 409 },
      );
    }
    const signer = new PublicKey(ownerWallet);
    const newOwner = new PublicKey(body.newOwnerWallet);
    const ix = {
      programId,
      keys: [
        { pubkey: productPda, isSigner: false, isWritable: true },
        { pubkey: signer, isSigner: true, isWritable: false },
        { pubkey: newOwner, isSigner: false, isWritable: false },
      ],
      data: Buffer.from([2]),
    };
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    const message = new TransactionMessage({
      payerKey: signer,
      recentBlockhash: blockhash,
      instructions: [ix],
    }).compileToV0Message();
    const tx = new VersionedTransaction(message);
    return NextResponse.json({
      action: body.action,
      pda: productPda.toBase58(),
      signer: signer.toBase58(),
      blockhash,
      transaction: Buffer.from(tx.serialize()).toString("base64"),
    });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
