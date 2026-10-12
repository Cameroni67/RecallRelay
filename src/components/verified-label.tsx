"use client";
import { CheckCircle2, Link2Off, LoaderCircle, ShieldAlert } from "lucide-react";
import type { Product } from "@/lib/data";
import { chainStatusOf } from "@/components/chain-status";

/**
 * Public verification label. Shows a real chain status instead of the old
 * fixed 350ms "checking" timer — there is nothing to wait for, the row a
 * server reconciled either has an on-chain record or it does not.
 */
export function VerifiedLabel({ recalled, product }: { recalled: boolean; product?: Product }) {
  const status = product ? chainStatusOf(product) : recalled ? "synced" : "unregistered";
  if (status === "pending") {
    return (
      <div aria-live="polite" className="inline-flex items-center gap-2 text-[11px] font-semibold">
        <LoaderCircle size={15} className="animate-spin text-muted" />Awaiting on-chain confirmation…
      </div>
    );
  }
  if (status === "error") {
    return (
      <div aria-live="polite" className="inline-flex items-center gap-2 text-[11px] font-semibold text-urgent">
        <ShieldAlert size={15} />Verification failed · could not confirm on chain
      </div>
    );
  }
  if (status === "unregistered") {
    return (
      <div aria-live="polite" className="inline-flex items-center gap-2 text-[11px] font-semibold text-muted">
        <Link2Off size={15} />Registered with RecallRelay · no on-chain record
      </div>
    );
  }
  return (
    <div aria-live="polite" className="inline-flex items-center gap-2 text-[11px] font-semibold">
      <CheckCircle2 size={15} className={recalled ? "text-urgent" : "text-safe"} />
      {recalled ? "Verified on Solana · active recall" : "Verified on Solana · authentic registration"}
    </div>
  );
}
