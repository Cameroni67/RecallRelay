import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/page-heading";
import { requireManufacturer } from "@/lib/auth/session";
import { listManufacturerRecalls } from "@/lib/db/products";
import { getRecallCounts } from "@/lib/db/manufacturer";
import { demoRecall } from "@/lib/db/demo";
import { formatDateShort } from "@/lib/db/mappers";

export default async function ManufacturerRecalls() {
  const ctx = await requireManufacturer();
  const recalls = ctx.demo ? [demoRecall] : await listManufacturerRecalls(ctx.manufacturer.id);
  const counts = await Promise.all(
    recalls.map((recall) => (ctx.demo ? Promise.resolve({ affectedUnits: 127, ownersReached: 127 }) : getRecallCounts(recall.id))),
  );

  return <AppShell manufacturer workspaceName={ctx.workspaceName}><PageHeading eyebrow={ctx.manufacturer.name} title="Recalls" description="Safety notices issued for registered product units." action={<Link href="/manufacturer/recalls/new" className="inline-flex items-center gap-2 bg-ink px-3.5 py-2.5 text-[10px] font-semibold text-white"><Plus size={13} /> Issue Recall</Link>} />
    <div className="mb-4 flex items-center justify-between"><p className="text-[11px] font-semibold">Active safety notices</p><span className="text-[10px] text-muted">{recalls.length} active</span></div>
    {recalls.length ? <div className="space-y-3">{recalls.map((recall, index) => <Link key={recall.id} href={`/manufacturer/recalls/${recall.id}`} className="block border border-[#e8c3bf] bg-[#fff8f6] p-4 sm:p-5"><div className="flex items-start gap-3"><AlertTriangle size={17} className="mt-0.5 text-urgent" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-bold tracking-[.12em] text-urgent">{recall.severity === "urgent" ? "URGENT" : recall.severity.toUpperCase()}</span><span className="text-[10px] text-muted">Issued {formatDateShort(recall.issued_at)}</span></div><h2 className="mt-2 text-[15px] font-semibold">{recall.title}</h2><p className="mt-1 text-[11px] text-muted">{counts[index].affectedUnits} registered units affected</p><div className="mt-4 flex items-center justify-between border-t border-[#e8c3bf] pt-3 text-[10px] text-muted"><span>{counts[index].ownersReached} current owners identified</span><ArrowUpRight size={13} /></div></div></div></Link>)}</div> : <div className="border border-line p-6 text-[12px] text-muted">No active recalls. Issue a recall when a safety issue is found.</div>}
    <div className="mt-8 border-t border-line pt-5"><p className="eyebrow">Safety publication</p><p className="mt-2 text-[12px] leading-5 text-muted">Recall notices are attached to affected product records so current owners can find required actions.</p></div></AppShell>;
}
