import { Check, ShieldCheck } from "lucide-react";
import { severityConfig } from "@/components/severity";

export function SafetyStatus({
  recalled,
  severity = "urgent",
  compact = false,
}: {
  recalled: boolean;
  severity?: string;
  compact?: boolean;
}) {
  if (recalled) {
    const { label, tone, Icon } = severityConfig(severity);
    return (
      <span className={`inline-flex items-center gap-1.5 font-semibold ${tone} ${compact ? "text-[11px]" : "text-sm"}`}>
        <Icon size={14} strokeWidth={1.8} />
        {compact ? label : `${label} — action required`}
      </span>
    );
  }
  return <span className={`inline-flex items-center gap-1.5 font-semibold text-safe ${compact ? "text-[11px]" : "text-sm"}`}><ShieldCheck size={15} strokeWidth={1.7} />No active recalls</span>;
}

export function VerificationBadge({ children = "Authentic registration" }: { children?: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-safe"><span className="flex size-[18px] items-center justify-center rounded-full border border-safe/30"><Check size={11} strokeWidth={2.4} /></span>{children}</span>;
}
