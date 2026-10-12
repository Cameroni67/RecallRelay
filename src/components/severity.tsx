import { AlertCircle, AlertTriangle, Info, type LucideIcon } from "lucide-react";
import type { RecallSeverity } from "@/lib/data";

/**
 * Severity display for recalls: restrained tones (urgent = red, important =
 * amber, advisory = neutral) always paired with an icon AND an explicit text
 * label, so severity is never communicated by color alone.
 */
export type SeverityConfig = {
  label: string;
  banner: string;
  tone: string;
  panel: string;
  Icon: LucideIcon;
};

const SEVERITIES: Record<RecallSeverity, SeverityConfig> = {
  urgent: {
    label: "Urgent recall",
    banner: "URGENT RECALL",
    tone: "text-urgent",
    panel: "border-[#e8c3bf] bg-[#fff8f6]",
    Icon: AlertTriangle,
  },
  important: {
    label: "Important recall",
    banner: "IMPORTANT RECALL",
    tone: "text-warning",
    panel: "border-[#e8dcbf] bg-[#fffaf0]",
    Icon: AlertCircle,
  },
  advisory: {
    label: "Advisory notice",
    banner: "ADVISORY NOTICE",
    tone: "text-muted",
    panel: "border-line bg-[#f7f6f2]",
    Icon: Info,
  },
};

export function severityConfig(severity: string | null | undefined): SeverityConfig {
  if (severity === "important" || severity === "advisory") return SEVERITIES[severity];
  return SEVERITIES.urgent;
}

export function SeverityMark({
  severity,
  compact = false,
}: {
  severity: string | null | undefined;
  compact?: boolean;
}) {
  const { label, tone, Icon } = severityConfig(severity);
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold ${tone} ${
        compact ? "text-[11px]" : "text-[12px]"
      }`}
    >
      <Icon size={compact ? 13 : 14} strokeWidth={1.8} aria-hidden />
      {label}
    </span>
  );
}
