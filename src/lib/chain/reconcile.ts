// Server-side reconciliation for RecallRelay Phase 3.
//
// Each function here reads the chain (never trusts the client), then calls
// the trusted SECURITY DEFINER RPC that records what the server observed.
// The `programId`/`pda`/`owner` values written to the database come from
// `observe*` above, so a lying client can only cause a re-read, not a wrong
// write.

import type { ServerSupabase } from "@/lib/supabase/server";
import {
  getConnection,
  hashIdentifier,
  manufacturerPdaFor,
  observeManufacturer,
  observeProduct,
  transactionSignedBy,
} from "@/lib/solana/chain";
import { PROGRAM_ID } from "@/lib/solana/deployment";
import { PublicKey } from "@solana/web3.js";

const PROGRAM = PROGRAM_ID;

export type ReconcileResult<T> =
  | { ok: true; state: "synced" | "pending"; data: T }
  | { ok: false; error: string; state?: "unregistered" | "error" };

/**
 * Mark a row as `pending` right after the client reports a transaction was
 * sent. This is the only place `pending` is written, and it happens before
 * the chain is readable, so the UI can show "confirming" honestly.
 */
export async function markManufacturerPending(
  supabase: ServerSupabase,
  manufacturerId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc("reconcile_manufacturer_chain_state", {
    p_manufacturer_id: manufacturerId,
    p_program_id: PROGRAM,
    p_pda: "",
    p_authority: "",
    p_state: "pending",
    p_tx_signature: undefined,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function markProductPending(
  supabase: ServerSupabase,
  unitId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc("reconcile_product_chain_state", {
    p_unit_id: unitId,
    p_program_id: PROGRAM,
    p_pda: "",
    p_owner: "",
    p_transfer_count: 0,
    p_state: "pending",
    p_tx_signature: undefined,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/**
 * Re-read the manufacturer account and record it as synced. Call this after
 * a registration transaction is confirmed, and on any later visit to retry
 * a row stuck in `pending`.
 */
export async function reconcileManufacturer(
  supabase: ServerSupabase,
  manufacturerId: string,
): Promise<ReconcileResult<{ pda: string; authority: string }>> {
  const observed = await observeManufacturer(manufacturerId);
  if (!observed) {
    return {
      ok: false,
      state: "unregistered",
      error: "No on-chain manufacturer account exists yet.",
    };
  }
  if (!observed.isActive) {
    return {
      ok: false,
      state: "error",
      error: "The on-chain manufacturer account is inactive.",
    };
  }
  const { error } = await supabase.rpc("reconcile_manufacturer_chain_state", {
    p_manufacturer_id: manufacturerId,
    p_program_id: PROGRAM,
    p_pda: observed.pda,
    p_authority: observed.authority,
    p_state: "synced",
    p_tx_signature: undefined,
  });
  if (error) return { ok: false, state: "error", error: error.message };
  return {
    ok: true,
    state: "synced",
    data: { pda: observed.pda, authority: observed.authority },
  };
}

/**
 * Re-read a product account and record it as synced. `manufacturerId` is
 * required to derive the PDA. When `txSignature` is provided it is verified
 * against the cluster before being stored.
 */
export async function reconcileProduct(
  supabase: ServerSupabase,
  unitId: string,
  manufacturerId: string,
  txSignature?: string | null,
): Promise<ReconcileResult<{ pda: string; owner: string; transferCount: number }>> {
  const observed = await observeProduct(unitId, manufacturerId);
  if (!observed) {
    return {
      ok: false,
      state: "unregistered",
      error: "No on-chain product account exists yet.",
    };
  }
  // The on-chain product must be bound to the manufacturer PDA derived from
  // this unit's server-known manufacturer — never to whatever the client said.
  const expectedManufacturerPda = manufacturerPdaFor(hashIdentifier(manufacturerId)).toBase58();
  if (observed.account.manufacturer !== expectedManufacturerPda) {
    return {
      ok: false,
      state: "error",
      error: "On-chain product account is not bound to this manufacturer.",
    };
  }
  let signature: string | null = null;
  if (txSignature) {
    const connection = getConnection();
    const valid = await transactionSignedBy(
      connection,
      txSignature,
      new PublicKey(observed.currentOwner),
    );
    signature = valid ? txSignature : null;
  }
  const { error } = await supabase.rpc("reconcile_product_chain_state", {
    p_unit_id: unitId,
    p_program_id: PROGRAM,
    p_pda: observed.pda,
    p_owner: observed.currentOwner,
    p_transfer_count: observed.transferCount,
    p_state: "synced",
    p_tx_signature: signature ?? undefined,
  });
  if (error) return { ok: false, state: "error", error: error.message };
  return {
    ok: true,
    state: "synced",
    data: {
      pda: observed.pda,
      owner: observed.currentOwner,
      transferCount: observed.transferCount,
    },
  };
}

/**
 * Reconcile an ownership transfer the client reports having signed on chain.
 * The chain is authoritative: we re-read the product account and, if its
 * transfer count moved past what the database holds, apply the transfer to
 * the profile that owns the new on-chain wallet. The client's claim about
 * who the new owner is plays no part — only the observed chain owner does.
 */
export async function reconcileTransfer(
  supabase: ServerSupabase,
  unitId: string,
  manufacturerId: string,
  txSignature: string,
): Promise<ReconcileResult<{ owner: string; transferCount: number; tx: string }>> {
  const observed = await observeProduct(unitId, manufacturerId);
  if (!observed) {
    return {
      ok: false,
      state: "unregistered",
      error: "No on-chain product account exists yet.",
    };
  }
  if (!observed.isActive) {
    return {
      ok: false,
      state: "error",
      error: "The on-chain product account is retired.",
    };
  }
  const connection = getConnection();
  const valid = await transactionSignedBy(
    connection,
    txSignature,
    new PublicKey(observed.currentOwner),
  );
  const { data: unit } = await supabase
    .from("product_units")
    .select("chain_transfer_count, chain_state")
    .eq("id", unitId)
    .maybeSingle();
  if (!unit) return { ok: false, error: "unknown product unit" };
  if (!valid) {
    return {
      ok: false,
      state: "error",
      error: "Transaction signature was not signed by the current on-chain owner.",
    };
  }
  if (observed.transferCount <= (unit.chain_transfer_count ?? 0)) {
    return {
      ok: false,
      error: "On-chain transfer count has not advanced past the recorded value.",
    };
  }
  // Map the observed on-chain owner wallet to a RecallRelay profile.
  const { data: profile } = await supabase.rpc("find_profile_by_wallet", {
    p_wallet: observed.currentOwner,
  });
  const row = Array.isArray(profile) ? profile[0] : profile;
  if (!row) {
    return {
      ok: false,
      state: "error",
      error: "The new on-chain owner wallet has no RecallRelay profile yet.",
    };
  }
  const { error } = await supabase.rpc("apply_chain_transfer", {
    p_unit_id: unitId,
    p_new_owner_wallet: observed.currentOwner,
    p_chain_owner: observed.currentOwner,
    p_transfer_count: observed.transferCount,
    p_tx_signature: txSignature,
  });
  if (error) return { ok: false, state: "error", error: error.message };
  return {
    ok: true,
    state: "synced",
    data: {
      owner: observed.currentOwner,
      transferCount: observed.transferCount,
      tx: txSignature,
    },
  };
}
