import { AlertTriangle, Check, ShieldCheck } from "lucide-react";

export function SafetyStatus({ recalled, compact = false }: { recalled: boolean; compact?: boolean }) {
  if (recalled) return <span className={`inline-flex items-center gap-1.5 font-semibold text-urgent ${compact ? "text-[11px]" : "text-sm"}`}><AlertTriangle size={14} strokeWidth={1.8} />{compact ? "Urgent recall" : "Urgent recall — action required"}</span>;
  return <span className={`inline-flex items-center gap-1.5 font-semibold text-safe ${compact ? "text-[11px]" : "text-sm"}`}><ShieldCheck size={15} strokeWidth={1.7} />{compact ? "No active recalls" : "No active recalls"}</span>;
}

export function VerificationBadge({ children = "Authentic registration" }: { children?: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-safe"><span className="flex size-[18px] items-center justify-center rounded-full border border-safe/30"><Check size={11} strokeWidth={2.4} /></span>{children}</span>;
}
