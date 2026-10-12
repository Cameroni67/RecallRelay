"use client";

import { useState } from "react";
import { Link2Off, Loader2, ShieldCheck } from "lucide-react";
import { connectWallet, signPreparedTransaction } from "@/lib/solana/wallet";

/**
 * Manufacturer on-chain registration panel.
 *
 * Phase 3: a manufacturer workspace can be registered as an on-chain account
 * so its product registrations are attributable to a real authority. The
 * server prepares the transaction and, after it lands, re-reads the chain and
 * records what it observed — the client never asserts chain state.
 */
export function ManufacturerChainPanel({
  manufacturerId,
  live,
  initialStatus,
  initialPda,
  sessionWallet = null,
}: {
  manufacturerId: string;
  live: boolean;
  initialStatus: "unregistered" | "synced";
  initialPda: string | null;
  /** The signed-in user's SIWS wallet — the authority wallet must match it. */
  sessionWallet?: string | null;
}) {
  const [status, setStatus] = useState<"unregistered" | "pending" | "synced">(initialStatus);
  const [pda, setPda] = useState<string | null>(initialPda);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function register() {
    setError(null);
    try {
      setNote("Preparing on-chain registration…");
      const authority = await connectWallet();
      if (sessionWallet && authority.toLowerCase() !== sessionWallet.toLowerCase()) {
        setNote(null);
        setError("Wallet mismatch — the connected wallet is not the signed-in wallet.");
        return;
      }
      const prepared = await fetch("/api/chain/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "initialize-manufacturer", manufacturerId, authority }),
      });
      const prep = await prepared.json();
      if (!prepared.ok) {
        setNote(null);
        setError(prep.error ?? "Could not prepare the transaction.");
        return;
      }
      setNote("Confirm in your wallet…");
      const signed = await signPreparedTransaction(prep.transaction);
      setStatus("pending");
      const sent = await fetch("/api/chain/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaction: signed }),
      });
      const sendResult = await sent.json();
      if (!sendResult.ok) {
        setStatus("unregistered");
        setNote(null);
        setError(sendResult.error ?? "The transaction failed on chain.");
        return;
      }
      setNote("Transaction confirmed. Syncing manufacturer record…");
      const reconciled = await fetch(`/api/manufacturers/${manufacturerId}/reconcile-chain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await reconciled.json();
      if (reconciled.ok && body.data?.pda) {
        setStatus("synced");
        setPda(body.data.pda);
        setNote(null);
      } else {
        setStatus("pending");
        setNote(body.error ?? "Transaction confirmed. Syncing manufacturer record.");
      }
    } catch (err) {
      setStatus("unregistered");
      setNote(null);
      setError(err instanceof Error ? err.message : "The wallet could not sign the transaction.");
    }
  }

  async function retry() {
    setError(null);
    setNote("Re-checking the chain…");
    const reconciled = await fetch(`/api/manufacturers/${manufacturerId}/reconcile-chain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const body = await reconciled.json();
    if (reconciled.ok && body.data?.pda) {
      setStatus("synced");
      setPda(body.data.pda);
      setNote(null);
    } else {
      setNote(body.error ?? "Still unable to confirm on chain.");
    }
  }

  if (!live) {
    return (
      <div className="mt-6 border-t border-line pt-4">
        <p className="text-[10px] leading-5 text-muted">
          On-chain registration is unavailable in demo mode.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 border-t border-line pt-4" data-chain-status={status}>
      <p className="eyebrow text-[9px]">Solana registration</p>
      {status === "synced" ? (
        <div className="mt-2 flex items-start gap-2">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-safe" />
          <div>
            <p className="text-[12px] font-semibold">Registered on Solana</p>
            {pda && <p className="mono mt-1 text-[10px] break-all text-muted">{pda}</p>}
          </div>
        </div>
      ) : status === "pending" ? (
        <div className="mt-2 flex items-start gap-2">
          <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin text-muted" />
          <div>
            <p className="text-[12px] font-semibold">Transaction confirmed. Syncing manufacturer record.</p>
            {note && <p className="mt-1 text-[10px] text-muted">{note}</p>}
            <button onClick={retry} className="mt-2 text-[11px] font-semibold underline underline-offset-4">
              Retry verification
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex items-start gap-2">
          <Link2Off size={16} className="mt-0.5 shrink-0 text-muted" />
          <div>
            <p className="text-[12px] font-semibold">No on-chain record yet</p>
            <p className="mt-1 text-[10px] leading-5 text-muted">
              Register this workspace on Solana so product registrations are signed by a real authority.
            </p>
            <button
              onClick={register}
              className="mt-2 inline-flex h-9 items-center gap-2 bg-ink px-3 text-[11px] font-semibold text-white hover:bg-[#303234]"
            >
              Register on Solana
            </button>
            {note && <p className="mt-2 text-[10px] text-muted">{note}</p>}
          </div>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-[11px] text-urgent">{error}</p>}
    </div>
  );
}
