"use client";

import { getDataLabel } from "@/lib/supabase/env";

const tones: Record<string, string> = {
  "Hosted data": "bg-[#e6f1e9] text-[#1f6b3a] border-[#cfe4d7]",
  "Local data": "bg-[#e8eefb] text-[#2b4fa2] border-[#cfdaf3]",
  "Demo data": "bg-[#f0eee8] text-muted border-line",
};

export function EnvBadge({ className = "" }: { className?: string }) {
  const label = getDataLabel();
  return (
    <span
      data-testid="env-badge"
      className={`inline-flex items-center gap-1.5 border px-2 py-1 text-[10px] font-semibold ${tones[label] ?? tones["Demo data"]} ${className}`}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </span>
  );
}
