import Link from "next/link";
import { ArrowRightLeft, ArrowUpRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/page-heading";
import { timeline, primaryProduct } from "@/lib/data";

export default function TransfersPage() {
  return <AppShell><PageHeading eyebrow="Product history" title="Transfers" description="Ownership handoffs recorded with the products you own." />
    <div className="border border-line bg-paper"><div className="grid grid-cols-[1fr_auto] gap-3 border-b border-line bg-[#f5f4f0] px-4 py-3 text-[10px] text-muted sm:grid-cols-[1fr_1.2fr_130px]"><span>PRODUCT & SERIAL</span><span>OWNERSHIP CHANGE</span><span className="hidden sm:block">DATE</span></div><Link href={`/app/products/${primaryProduct.id}`} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-4 hover:bg-[#faf9f6] sm:grid-cols-[1fr_1.2fr_130px]"><div><p className="text-[12px] font-semibold">HeatCore 10K</p><p className="mono mt-1 text-[10px] text-muted">HC10-2048</p></div><div className="flex items-center gap-2 text-[11px]"><span className="text-muted">Alice Morgan</span><ArrowRightLeft size={13} className="text-muted" /><span className="font-semibold">Bob Chen</span></div><div className="hidden items-center justify-between text-[11px] text-muted sm:flex">Oct 8, 2026 <ArrowUpRight size={13} /></div><p className="col-span-2 text-[10px] text-muted sm:hidden">Oct 8, 2026 · Completed</p></Link></div>
    <div className="mt-7 border-t border-line pt-5"><p className="eyebrow">Earlier ownership</p><div className="mt-3 flex items-start gap-3"><span className="mt-1 size-2 border border-[#b5b6b1]" /><div><p className="text-[12px] font-semibold">Alice Morgan received HeatCore 10K</p><p className="mt-1 text-[11px] text-muted">Initial owner · Oct 2, 2026</p></div></div><p className="mt-5 text-[10px] text-muted">{timeline.length} recorded events in this product’s history.</p></div>
  </AppShell>;
}
