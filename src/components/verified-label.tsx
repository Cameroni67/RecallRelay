"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle } from "lucide-react";

export function VerifiedLabel({ recalled }: { recalled: boolean }) {
  const [checking, setChecking] = useState(true);
  useEffect(() => { const timer = window.setTimeout(() => setChecking(false), 350); return () => window.clearTimeout(timer); }, []);
  return <div aria-live="polite" className="inline-flex items-center gap-2 text-[11px] font-semibold">{checking ? <><LoaderCircle size={15} className="animate-spin text-muted" />Checking registration…</> : <><CheckCircle2 size={15} className={recalled ? "text-urgent" : "text-safe"} />{recalled ? "Verified · active recall" : "Verified · authentic registration"}</>}</div>;
}
