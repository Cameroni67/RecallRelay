import { ArrowUpRight, ScanLine } from "lucide-react";
import Link from "next/link";

export function QrCard({ id }: { id: string }) {
  return <div className="border border-line bg-paper p-5">
    <div className="flex items-start justify-between gap-4">
      <div><p className="eyebrow">Public record</p><h3 className="mt-2 text-[15px] font-semibold">Verify this product</h3><p className="mt-1 max-w-[220px] text-[12px] leading-5 text-muted">Scan to check authenticity, ownership status, and active recalls.</p></div>
      <ScanLine size={17} className="mt-1 text-muted" strokeWidth={1.6} />
    </div>
    <Link href={`/verify/${id}`} aria-label="Open public verification" className="mt-5 flex items-center gap-4 border-t border-line pt-4">
      <div className="qr-grid" aria-hidden="true">{Array.from({ length: 81 }, (_, i) => <i key={i} className={[0,1,2,3,4,9,13,18,19,20,22,23,26,27,28,31,32,33,36,37,38,40,41,44,45,46,49,50,53,54,57,58,59,62,63,64,67,68,72,73,74,75,76,77,78,79,80].includes(i) ? "filled" : ""} />)}</div>
      <div><p className="mono text-[11px] text-muted">RR · {id}</p><p className="mt-1 flex items-center gap-1 text-[12px] font-medium">Open public record <ArrowUpRight size={13} /></p></div>
    </Link>
  </div>;
}
