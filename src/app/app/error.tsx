"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RotateCcw } from "lucide-react";

/**
 * Owner workspace error boundary. Shows friendly copy + retry only — the
 * underlying error (which may contain database messages) is never rendered.
 */
export default function WorkspaceError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("workspace route error");
  }, []);
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-start justify-center px-6">
      <AlertCircle size={22} className="text-muted" />
      <p className="eyebrow mt-5">Unable to load this view</p>
      <h1 className="mt-2 text-[28px] font-semibold tracking-[-.05em]">
        Something went wrong loading this page.
      </h1>
      <p className="mt-2 text-[12px] leading-5 text-muted">
        Your products and safety records are safe. Try again, or return to your workspace.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          onClick={reset}
          className="inline-flex h-10 items-center gap-2 bg-ink px-4 text-[11px] font-semibold text-white"
        >
          <RotateCcw size={13} /> Try again
        </button>
        <Link
          href="/app/products"
          className="inline-flex h-10 items-center border border-line px-4 text-[11px] font-semibold"
        >
          Return to my products
        </Link>
      </div>
    </main>
  );
}
