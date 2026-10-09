"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, ArrowRight, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { ProductArt } from "@/components/product-art";
import type { Product } from "@/lib/data";
import { getBrowserClient } from "@/lib/supabase/client";

export function TransferFlow({ product, unitId, live = false }: { product: Product; unitId?: string; live?: boolean }) {
  const [recipient, setRecipient] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [stage, setStage] = useState<"edit" | "review" | "done">("edit");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

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
      </> : <div className="py-8"><CheckCircle2 size={28} className="text-safe" strokeWidth={1.5} /><p className="eyebrow mt-5">Handoff complete</p><h2 className="mt-2 text-[26px] font-semibold tracking-[-.05em]">Ownership transferred</h2><p className="mt-3 text-[13px]">{product.name} now belongs to {displayName}.</p><div className="mt-5 flex items-center gap-2 border-y border-line py-4 text-[11px] text-muted"><ShieldCheck size={15} className="text-safe" />Ownership verified on Solana <span className="ml-auto underline underline-offset-4">View transaction</span></div><p className="mt-3 text-[10px] text-muted">{live ? "Transfer saved to the product record." : "Transfer completion is local to this preview."}</p><Link href="/app/transfers" className="mt-6 inline-flex items-center gap-2 text-[12px] font-semibold underline underline-offset-4">View transfer history <ArrowRight size={14} /></Link></div>}
    </section>
    <aside className="self-start border border-line bg-[#f0eee8] p-4"><ProductArt src={product.image} alt={product.name} className="aspect-[1.5/1] border border-line bg-[#eeede8]" /><p className="eyebrow mt-4">Product being transferred</p><h3 className="mt-1 text-[16px] font-semibold">{product.name}</h3><p className="mono mt-1 text-[10px] text-muted">{product.serial}</p><p className="mt-4 border-t border-line pt-3 text-[11px] leading-5 text-muted">The product’s safety status and ownership history remain attached.</p></aside>
  </div>;
}
