"use client";
import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RotateCcw } from "lucide-react";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {}, []);
  return <main className="mx-auto flex min-h-screen max-w-xl flex-col items-start justify-center px-6"><AlertCircle size={22} className="text-muted" /><p className="eyebrow mt-5">Unable to load this view</p><h1 className="mt-2 text-[28px] font-semibold tracking-[-.05em]">This record is temporarily unavailable.</h1><p className="mt-2 text-[12px] leading-5 text-muted">Please try again. Product and verification records remain private to this preview.</p><div className="mt-6 flex gap-3"><button onClick={reset} className="inline-flex h-10 items-center gap-2 bg-ink px-4 text-[11px] font-semibold text-white"><RotateCcw size={13} />Try again</button><Link href="/" className="inline-flex h-10 items-center border border-line px-4 text-[11px] font-semibold">Return home</Link></div></main>;
}
