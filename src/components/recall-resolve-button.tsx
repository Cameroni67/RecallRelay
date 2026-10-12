"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/client";

/**
 * Resolve (close) a recall. Server/DB-side validation decides authorization
 * and status transitions — this button only asks for confirmation, calls the
 * SECURITY DEFINER `close_recall` RPC, and refreshes on success. Resolution
 * notifies current owners only, exactly once (deduped in the database).
 */
export function RecallResolveButton({ recallId, live = true }: { recallId: string; live?: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!live) return null;

  async function resolve() {
    const supabase = getBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured in this environment.");
      return;
    }
    setWorking(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("close_recall", { p_recall_id: recallId });
    setWorking(false);
    if (rpcError) {
      console.error("close_recall failed", rpcError);
      const lower = rpcError.message.toLowerCase();
      setError(
        lower.includes("owners or admins")
          ? "You need manufacturer owner access to manage recalls."
          : "The recall could not be resolved. Please try again.",
      );
      return;
    }
    setConfirming(false);
    router.refresh();
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex h-10 items-center gap-2 border border-line bg-paper px-4 text-[12px] font-semibold hover:border-ink"
      >
        <CheckCircle2 size={14} />
        Resolve recall
      </button>
    );
  }

  return (
    <div className="border border-line bg-[#f7f6f2] p-4" role="alertdialog" aria-label="Confirm resolving this recall">
      <p className="text-[12px] font-semibold">Resolve this recall?</p>
      <p className="mt-1 text-[11px] leading-5 text-muted">
        The recall moves to Resolved, disappears from active product safety pages, and every current owner of an
        affected unit receives a resolution notice. Nothing is deleted.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-[11px] text-urgent">
          {error}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={resolve}
          disabled={working}
          className="inline-flex h-9 items-center gap-2 bg-ink px-4 text-[11px] font-semibold text-white disabled:opacity-60"
        >
          {working && <Loader2 size={13} className="animate-spin" />}
          {working ? "Resolving…" : "Yes, resolve recall"}
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
          disabled={working}
          className="h-9 border border-line bg-paper px-4 text-[11px] font-semibold"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
