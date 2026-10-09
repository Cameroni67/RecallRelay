import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/page-heading";
import { requireManufacturer } from "@/lib/auth/session";
import { getModelById, getRecallCounts } from "@/lib/db/manufacturer";
import { findManufacturerRecall } from "@/lib/db/products";
import { demoModels } from "@/lib/db/demo";
import { formatDateLong } from "@/lib/db/mappers";

export default async function ManufacturerRecallDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireManufacturer();

  if (ctx.demo) {
    if (!id.startsWith("recall-hc10")) notFound();
    return <AppShell manufacturer workspaceName={ctx.workspaceName}><PageHeading eyebrow="Recall detail · Northstar Outdoor Tech" title="Battery overheating risk" description="Urgent product safety notice · Issued Oct 9, 2026" action={<span className="inline-flex items-center gap-1.5 border border-[#e8c3bf] bg-[#fff8f6] px-3 py-2 text-[10px] font-bold text-urgent"><AlertTriangle size={13} /> URGENT</span>} />
      <section role="alert" className="border border-[#e8c3bf] bg-[#fff8f6] p-5 sm:p-6"><p className="text-[10px] font-bold tracking-[.12em] text-urgent">REQUIRED ACTION</p><h2 className="mt-2 text-[19px] font-semibold">Stop using immediately.</h2><p className="mt-2 max-w-xl text-[12px] leading-5 text-muted">A battery cell may overheat during charging, creating a fire risk. Disconnect the unit from power and discontinue use.</p></section>
      <div className="mt-6 grid border border-line sm:grid-cols-2"><div className="border-b border-line p-4 sm:border-r"><p className="eyebrow">Affected model</p><Link href="/manufacturer/products/HC10" className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold underline underline-offset-4">HeatCore 10K · HC10 <ArrowUpRight size={13} /></Link></div><div className="border-b border-line p-4"><p className="eyebrow">Affected registered units</p><p className="mt-2 text-[19px] font-semibold">127</p></div><div className="border-b border-line p-4 sm:border-b-0 sm:border-r"><p className="eyebrow">Current owners reached</p><p className="mt-2 text-[19px] font-semibold">127</p><p className="mt-1 text-[10px] text-muted">Current ownership records identified</p></div><div className="p-4"><p className="eyebrow">Issued</p><p className="mt-2 text-[13px] font-semibold">October 9, 2026</p><p className="mt-1 text-[10px] text-muted">Published by Northstar Outdoor Tech</p></div></div>
      <div className="mt-7 flex items-start gap-2 border-t border-line pt-5 text-[11px] text-muted"><CheckCircle2 size={15} className="text-safe" /><p>This recall is included in the public product record. <Link href="/verify/HC10-2048" className="font-semibold text-ink underline underline-offset-4">View product verification <ArrowUpRight className="inline" size={12} /></Link></p></div></AppShell>;
  }

  const recall = await findManufacturerRecall(id, ctx.manufacturer.id);
  if (!recall) notFound();
  const [model, counts] = await Promise.all([
    recall.model_id ? getModelById(recall.model_id) : Promise.resolve(null),
    getRecallCounts(recall.id),
  ]);
  const demoModel = model ? demoModels.find((entry) => entry.name === model.name) : undefined;
  const modelSku = model?.sku ?? demoModel?.id ?? "";
  const modelName = model?.name ?? demoModel?.name ?? "Unknown model";

  return <AppShell manufacturer workspaceName={ctx.workspaceName}><PageHeading eyebrow="Recall detail · Northstar" title={recall.title} description={`${recall.severity === "urgent" ? "Urgent product safety notice" : "Product safety notice"} · Issued ${formatDateLong(recall.issued_at)}`} action={<span className="inline-flex items-center gap-1.5 border border-[#e8c3bf] bg-[#fff8f6] px-3 py-2 text-[10px] font-bold text-urgent"><AlertTriangle size={13} /> {recall.severity.toUpperCase()}</span>} />
    <section role="alert" className="border border-[#e8c3bf] bg-[#fff8f6] p-5 sm:p-6"><p className="text-[10px] font-bold tracking-[.12em] text-urgent">REQUIRED ACTION</p><h2 className="mt-2 text-[19px] font-semibold">{recall.required_action}</h2><p className="mt-2 max-w-xl text-[12px] leading-5 text-muted">Scope: {recall.scope_kind === "all_units" ? "All registered units" : recall.scope_kind === "serial_range" ? `Serial range ${recall.serial_from} – ${recall.serial_to}` : `${(recall.recall_units ?? []).length} selected units`}.</p></section>
    <div className="mt-6 grid border border-line sm:grid-cols-2"><div className="border-b border-line p-4 sm:border-r"><p className="eyebrow">Affected model</p><Link href={`/manufacturer/products/${modelSku}`} className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold underline underline-offset-4">{modelName} {modelSku && <>· {modelSku}</>} <ArrowUpRight size={13} /></Link></div><div className="border-b border-line p-4"><p className="eyebrow">Affected registered units</p><p className="mt-2 text-[19px] font-semibold">{counts.affectedUnits}</p></div><div className="border-b border-line p-4 sm:border-b-0 sm:border-r"><p className="eyebrow">Current owners reached</p><p className="mt-2 text-[19px] font-semibold">{counts.ownersReached}</p><p className="mt-1 text-[10px] text-muted">Current ownership records identified</p></div><div className="p-4"><p className="eyebrow">Issued</p><p className="mt-2 text-[13px] font-semibold">{formatDateLong(recall.issued_at)}</p><p className="mt-1 text-[10px] text-muted">Published by {ctx.manufacturer.name}</p></div></div>
    <div className="mt-7 flex items-start gap-2 border-t border-line pt-5 text-[11px] text-muted"><CheckCircle2 size={15} className="text-safe" /><p>This recall is included in the public product record. {modelSku && <Link href={`/verify/${modelSku}`} className="font-semibold text-ink underline underline-offset-4">View product verification <ArrowUpRight className="inline" size={12} /></Link>}</p></div></AppShell>;
}
