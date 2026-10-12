"use client";

import { useState } from "react";
import { ExternalLink, Link2Off, Loader2, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import type { Product, ProductChainState } from "@/lib/data";
import { explorerAccountLink, explorerTxLink } from "@/lib/solana/deployment";

/**
 * Truthful on-chain verification status for a passport.
 *
 * Phase 3 rule: never claim "verified on Solana" unless the server has
 * actually observed the account. Each state renders its own honest copy and
 * its own icon, and only a `synced` state links to a real transaction.
 */

export type ChainStatus = "unregistered" | "pending" | "synced" | "error";

export function chainStatusOf(product: Product, error?: boolean): ChainStatus {
  if (error) return "error";
  const chain = product.chain;
  if (!chain) return "unregistered";
  if (!chain.owner && !chain.syncedAt) return "pending";
  return "synced";
}

const COPY: Record<ChainStatus, { label: string; detail: string }> = {
  unregistered: {
    label: "Not registered on Solana",
    detail: "This unit has no on-chain record yet.",
  },
  pending: {
    label: "Awaiting confirmation",
    detail: "A registration transaction was sent and is waiting to be confirmed.",
  },
  synced: {
    label: "Verified on Solana",
    detail: "Ownership is recorded on chain and was confirmed by our servers.",
  },
  error: {
    label: "Verification failed",
    detail: "We could not confirm this unit on chain. This is a real problem, not a delay.",
  },
};

export function ChainStatusBadge({
  chain,
  status,
  unitId,
  compact = false,
  publicMode = false,
}: {
  chain?: ProductChainState | null;
  status: ChainStatus;
  unitId?: string;
  compact?: boolean;
  /** Public verification: retry via session-free GET, never writes, never downgrades. */
  publicMode?: boolean;
}) {
  const [retrying, setRetrying] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [liveConfirmed, setLiveConfirmed] = useState(false);

  /**
   * Chain-succeeds-but-DB-failed recovery. The transaction already landed, so
   * we must never re-register — we re-ask the server to reconcile the record
   * it should already be able to see on chain.
   *
   * In `publicMode` the retry is a session-free GET: it can only REFINE what
   * is shown upward (pending/error → confirmed) and must never downgrade a
   * server-observed record or hide safety information when the cluster is
   * briefly unreachable.
   */
  async function retryVerification() {
    if (!unitId) return;
    setRetrying(true);
    setNote(null);
    try {
      if (publicMode) {
        const res = await fetch(`/api/chain/state?unitId=${encodeURIComponent(unitId)}`);
        const body = await res.json().catch(() => ({}));
        if (res.ok && body.registered) {
          setLiveConfirmed(true);
          setNote("Confirmed live on Solana. Safety information above is unaffected.");
        } else if (res.ok) {
          setNote(
            "The cluster did not return this account on this attempt. The last server-confirmed record above stands — safety information is unaffected.",
          );
        } else {
          setNote(
            body.error ??
              "Chain verification is temporarily unavailable. The safety information on this page is unaffected.",
          );
        }
        return;
      }
      const res = await fetch(`/api/products/${unitId}/reconcile-chain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.state === "synced") {
        setNote("Verified. Refresh to see the updated passport.");
      } else {
        setNote(body.error ?? "Still unable to confirm. The record will retry on next load.");
      }
    } catch {
      setNote(
        publicMode
          ? "Chain verification is temporarily unavailable. The safety information on this page is unaffected."
          : "Network error while retrying. The record will retry on next load.",
      );
    } finally {
      setRetrying(false);
    }
  }

  const shown: ChainStatus = liveConfirmed ? "synced" : status;
  const copy = COPY[shown];
  const Icon =
    shown === "synced" ? ShieldCheck : shown === "pending" ? Loader2 : shown === "error" ? ShieldAlert : Link2Off;
  const tone =
    shown === "synced"
      ? "text-safe"
      : shown === "pending"
        ? "text-muted"
        : shown === "error"
          ? "text-urgent"
          : "text-muted";
  return (
    <div
      data-chain-status={shown}
      className={`flex items-start gap-2 ${compact ? "" : "border border-line bg-[#f7f6f2] px-4 py-3"}`}
    >
      <Icon size={compact ? 14 : 16} className={`mt-0.5 shrink-0 ${tone} ${shown === "pending" ? "animate-pulse" : ""}`} />
      <div>
        <p className={`font-semibold ${compact ? "text-[11px]" : "text-[13px]"}`}>{copy.label}</p>
        {!compact && <p className="mt-1 text-[12px] leading-5 text-muted">{copy.detail}</p>}
        {shown === "synced" && chain?.pda && (
          <p className="mt-1 text-[11px] text-muted">
            <a
              className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-ink"
              href={explorerAccountLink(chain.pda)}
              target="_blank"
              rel="noreferrer"
            >
              View account <ExternalLink size={11} />
            </a>
            {chain.txSignature && (
              <>
                <span className="mx-2 text-line">/</span>
                <a
                  className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-ink"
                  href={explorerTxLink(chain.txSignature)}
                  target="_blank"
                  rel="noreferrer"
                >
                  View transaction <ExternalLink size={11} />
                </a>
              </>
            )}
          </p>
        )}
        {(shown === "pending" || shown === "error") && unitId && (
          <button
            type="button"
            onClick={retryVerification}
            disabled={retrying}
            className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-ink underline underline-offset-4 disabled:opacity-60"
          >
            <RefreshCw size={11} className={retrying ? "animate-spin" : ""} />
            {retrying ? "Checking chain…" : "Retry verification"}
          </button>
        )}
        {note && <p className="mt-1 text-[11px] text-muted">{note}</p>}
      </div>
    </div>
  );
}
