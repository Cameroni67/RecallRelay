import { Clock3 } from "lucide-react";

export type TimelineEntry = { title: string; date: string; detail: string };

export function ProductTimeline({ entries }: { entries: TimelineEntry[] }) {
  return <section aria-labelledby="history-heading"><div className="flex items-center justify-between border-b border-line pb-3"><h2 id="history-heading" className="text-[15px] font-semibold">Ownership & safety history</h2><Clock3 size={16} className="text-muted" /></div>
    <ol className="mt-5">{entries.map((entry, index) => <li key={`${entry.title}-${entry.date}`} className="relative grid grid-cols-[18px_1fr_auto] gap-x-3 pb-6 last:pb-0">
      {index !== entries.length - 1 && <span className="absolute bottom-0 left-[8px] top-[11px] w-px bg-line" aria-hidden="true" />}
      <span className={`relative z-10 mt-1 size-[17px] rounded-full border bg-paper ${index === entries.length - 1 ? "border-blue" : "border-[#c9c9c3]"}`} />
      <div><p className="text-[13px] font-semibold">{entry.title}</p><p className="mt-1 text-[12px] leading-5 text-muted">{entry.detail}</p></div><time className="pt-0.5 text-[11px] text-muted">{entry.date}</time>
    </li>)}</ol></section>;
}
