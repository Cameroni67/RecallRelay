"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RotateCcw } from "lucide-react";

/**
 * Public verification error boundary. When the database or chain read fails,
 * we show a controlled retry state with NO sensitive details — and we never
 * imply a verified product failed verification.
 */
export default function VerifyError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("verify route error");
  }, []);
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-start justify-center px-6">
      <AlertCircle size={22} className="text-muted" />
      <p className="eyebrow mt-5">Verification temporarily unavailable</p>
      <h1 className="mt-2 text-[28px] font-semibold tracking-[-.05em]">
        We could not load this public record right now.
      </h1>
      <p className="mt-2 text-[12px] leading-5 text-muted">
        This is a loading problem, not a verdict on the product. Safety notices are unaffected — try again in a
        moment.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          onClick={reset}
          className="inline-flex h-10 items-center gap-2 bg-ink px-4 text-[11px] font-semibold text-white"
        >
          <RotateCcw size={13} /> Try again
        </button>
        <Link
          href="/"
          className="inline-flex h-10 items-center border border-line px-4 text-[11px] font-semibold"
        >
          Return home
        </Link>
      </div>
    </main>
  );
}
