"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { ProductArt } from "@/components/product-art";
import type { Product } from "@/lib/data";
import { getBrowserClient } from "@/lib/supabase/client";
import { connectWallet, signPreparedTransaction } from "@/lib/solana/wallet";

export function TransferFlow({
  product,
  unitId,
  live = false,
  sessionWallet = null,
}: {
  product: Product;
  unitId?: string;
  live?: boolean;
  /** The signed-in user's SIWS wallet — the transaction wallet must match it. */
  sessionWallet?: string | null;
}) {
  const [recipient, setRecipient] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [stage, setStage] = useState<"edit" | "review" | "done">("edit");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [chainTx, setChainTx] = useState<string | null>(null);
  const [chainSynced, setChainSynced] = useState(false);

  async function review(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = recipient.trim();
    if (!trimmed) return;
    setError(null);

    if (!live) {
      setDisplayName(trimmed);
      setStage("review");
      return;
    }

    const supabase = getBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured in this environment.");
      return;
    }
    const { data, error: rpcError } = await supabase.rpc("find_profile_by_wallet", {
      p_wallet: trimmed,
    });
    if (rpcError) {
      setError("Recipient wallet not found.");
      return;
    }
    const row = Array.isArray(data) ? data[0] : null;
    if (!row || row.is_self) {
      setError(row?.is_self ? "That wallet is already the owner." : "Recipient wallet not found.");
      return;
    }
    setDisplayName(row.full_name);
    setStage("review");
  }

  async function confirm() {
    if (!live) {
      setStage("done");
      return;
    }
    const supabase = getBrowserClient();
    if (!supabase || !unitId) {
      setError("Supabase is not configured in this environment.");
      return;
    }
    setWorking(true);
    setError(null);

    // Phase 3: a unit with an on-chain record transfers on chain. The
    // database-only RPC refuses these, so we never move ownership off-chain
    // for a product that Solana knows about.
    if (product.chain?.pda) {
      try {
        const connected = await connectWallet();
        if (sessionWallet && connected.toLowerCase() !== sessionWallet.toLowerCase()) {
          setWorking(false);
          setError("Wallet mismatch — the connected wallet is not the signed-in wallet.");
          return;
        }
        const prepared = await fetch("/api/chain/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "transfer-product", unitId, newOwnerWallet: recipient.trim() }),
        });
        const prep = await prepared.json();
        if (!prepared.ok) {
          setWorking(false);
          setError(prep.error ?? "Could not prepare the transfer transaction.");
          return;
        }
        const signed = await signPreparedTransaction(prep.transaction);
        const sent = await fetch("/api/chain/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transaction: signed }),
        });
        const sendResult = await sent.json();
        if (!sendResult.ok) {
          setWorking(false);
          setError(sendResult.error ?? "The transfer transaction failed on chain.");
          return;
        }
        setChainTx(sendResult.signature);
        // The chain now holds the new owner. Reconcile records it in the
        // database; if that fails the transaction is still real, so we show
        // "confirmed, syncing" rather than pretending it did not happen.
        const reconciled = await fetch("/api/chain/reconcile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "transfer", unitId, txSignature: sendResult.signature }),
        });
        setWorking(false);
        if (reconciled.ok) {
          setChainSynced(true);
        }
        setStage("done");
        return;
      } catch (err) {
        setWorking(false);
        setError(err instanceof Error ? err.message : "The wallet could not sign the transfer.");
        return;
      }
    }

    // No on-chain record: Phase 2 database transfer still applies.
    const { error: rpcError } = await supabase.rpc("transfer_product_ownership", {
      p_unit_id: unitId,
      p_recipient_wallet: recipient.trim(),
    });
    setWorking(false);
    if (rpcError) {
      const lower = rpcError.message.toLowerCase();
      setError(
        lower.includes("no recallrelay profile for that wallet")
          ? "Recipient wallet not found."
          : lower.includes("only the current owner")
            ? "Only the current owner can transfer this product."
            : lower.includes("cannot transfer to yourself")
              ? "That wallet is already the owner."
              : lower.includes("recorded on solana")
                ? "This product is recorded on Solana and must be transferred on chain."
                : rpcError.message,
      );
      return;
    }
    setStage("done");
  }

  return <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
    <section className="border border-line bg-paper p-5 sm:p-7">
      {stage !== "done" ? <><p className="eyebrow">Ownership handoff</p><h2 className="mt-2 text-[23px] font-semibold tracking-[-.04em]">Transfer {product.name}</h2><p className="mt-2 max-w-lg text-[12px] leading-5 text-muted">This transfers the product’s ownership record to the recipient. Its history and safety notices stay with the product.</p>
        <div className="mt-7 grid gap-4 border-y border-line py-5 sm:grid-cols-2"><div><p className="eyebrow text-[9px]">Product</p><p className="mt-2 text-[13px] font-semibold">{product.name}</p><p className="mono mt-1 text-[11px] text-muted">{product.serial}</p></div><div><p className="eyebrow text-[9px]">Current owner</p><p className="mt-2 text-[13px] font-semibold">You</p></div></div>
        {stage === "edit" ? <form onSubmit={review} className="mt-6"><label htmlFor="recipient" className="text-[12px] font-semibold">Recipient</label><input required id="recipient" value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder={live ? "Recipient wallet address" : "Name or recipient reference"} className="mt-2 block h-11 w-full border border-line bg-paper px-3 text-[12px] placeholder:text-[#9b9d99] focus:border-blue focus:outline-none" /><p className="mt-2 text-[10px] text-muted">{live ? "The recipient must already have a RecallRelay profile for this wallet." : "Demo field only. No wallet connection or transaction is used."}</p>{error && <p role="alert" className="mt-3 text-[11px] text-urgent">{error}</p>}<button type="submit" className="mt-6 inline-flex h-10 items-center gap-2 bg-ink px-4 text-[12px] font-semibold text-white hover:bg-[#303234]">Review Transfer <ArrowRight size={14} /></button></form> : <div className="mt-6"><div className="border border-line bg-[#f7f6f2] p-5"><p className="eyebrow">Transfer review</p><div className="mt-5 flex items-center justify-between gap-2"><div><p className="text-[12px] font-semibold">You</p><p className="mt-1 text-[10px] text-muted">Current owner</p></div><div className="flex flex-1 items-center justify-center px-4"><span className="h-px flex-1 bg-line" /><ArrowRight size={15} className="mx-2 text-muted" /></div><div className="text-right"><p className="text-[12px] font-semibold">{displayName}</p><p className="mt-1 text-[10px] text-muted">New owner</p></div></div></div>{error && <p role="alert" className="mt-3 text-[11px] text-urgent">{error}</p>}<div className="mt-5 flex gap-2"><button type="button" onClick={() => setStage("edit")} className="h-10 border border-line px-4 text-[12px] font-semibold">Back</button><button type="button" onClick={confirm} disabled={working} className="inline-flex h-10 items-center gap-2 bg-ink px-4 text-[12px] font-semibold text-white disabled:opacity-60">{working && <Loader2 size={14} className="animate-spin" />}Confirm Transfer <ArrowLeftRight size={14} /></button></div><p className="mt-3 text-[10px] text-muted">{live ? "Confirming saves the new owner to the product’s permanent record." : "This is a local preview. It won’t send a transaction or save account changes."}</p></div>}
      </> : <div className="py-8"><CheckCircle2 size={28} className="text-safe" strokeWidth={1.5} /><p className="eyebrow mt-5">Handoff complete</p><h2 className="mt-2 text-[26px] font-semibold tracking-[-.05em]">Ownership transferred</h2><p className="mt-3 text-[13px]">{product.name} now belongs to {displayName}.</p>{chainTx ? <div className="mt-5 flex items-center gap-2 border-y border-line py-4 text-[11px] text-muted">{chainSynced ? <>Recorded on Solana and synced to the product record.</> : <>Transaction confirmed. Syncing product record.</>}<a className="ml-auto underline underline-offset-4" href={`https://explorer.solana.com/tx/${chainTx}?cluster=devnet`} target="_blank" rel="noreferrer">View transaction</a></div> : null}<p className="mt-3 text-[10px] text-muted">{live ? (chainTx ? "Ownership moved on chain; the database now matches." : "Transfer saved to the product record.") : "Transfer completion is local to this preview."}</p><Link href="/app/transfers" className="mt-6 inline-flex items-center gap-2 text-[12px] font-semibold underline underline-offset-4">View transfer history <ArrowRight size={14} /></Link></div>}
    </section>
    <aside className="self-start border border-line bg-[#f0eee8] p-4"><ProductArt src={product.image} alt={product.name} className="aspect-[1.5/1] border border-line bg-[#eeede8]" /><p className="eyebrow mt-4">Product being transferred</p><h3 className="mt-1 text-[16px] font-semibold">{product.name}</h3><p className="mono mt-1 text-[10px] text-muted">{product.serial}</p><p className="mt-4 border-t border-line pt-3 text-[11px] leading-5 text-muted">The product’s safety status and ownership history remain attached.</p></aside>
  </div>;
}
