import Link from "next/link";
import { ArrowRight, ArrowUpRight, Boxes, Package, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { requireManufacturer } from "@/lib/auth/session";
import { getManufacturerStats, listModels } from "@/lib/db/manufacturer";
import { demoProducts } from "@/lib/db/demo";

export default async function ManufacturerHome() {
  const ctx = await requireManufacturer();
  const [stats, models] = await Promise.all([
    getManufacturerStats(ctx.manufacturer.id),
    listModels(ctx.manufacturer.id),
  ]);
  const demo = ctx.demo;
  const featured = models.slice(0, 3);

  return <AppShell manufacturer workspaceName={ctx.workspaceName}><div className="mb-7 flex flex-col justify-between gap-3 border-b border-line pb-5 sm:flex-row sm:items-end"><div><p className="eyebrow">Manufacturer workspace · {ctx.manufacturer.name}</p><h1 className="mt-2 text-[28px] font-semibold tracking-[-.05em]">Product records</h1><p className="mt-1.5 text-[12px] text-muted">Units, product passports, and active safety notices.</p></div><Link href="/manufacturer/register" className="inline-flex h-10 items-center justify-center gap-2 bg-ink px-4 text-[11px] font-semibold text-white"><Plus size={14} /> Register Product</Link></div>
    <div className="grid border border-line sm:grid-cols-3"><div className="border-b border-line p-4 sm:border-b-0 sm:border-r"><p className="eyebrow">Registered units</p><p className="mt-3 text-[27px] font-semibold tracking-[-.05em]">{stats.registeredUnits}</p><p className="mt-1 text-[10px] text-muted">Across {stats.modelCount} product models</p></div><div className="border-b border-line p-4 sm:border-b-0 sm:border-r"><p className="eyebrow">Active recalls</p><p className="mt-3 text-[27px] font-semibold tracking-[-.05em]">{stats.activeRecalls}</p><p className="mt-1 text-[10px] text-muted">{stats.activeRecalls ? "Requires owner action" : "No active recalls"}</p></div><div className="p-4"><p className="eyebrow">Current owners reached</p><p className="mt-3 text-[27px] font-semibold tracking-[-.05em]">{stats.ownersReached}</p><p className="mt-1 text-[10px] text-muted">Affected owners identified</p></div></div>
    <div className="mb-3 mt-9 flex items-end justify-between"><div><p className="eyebrow">Product models</p><h2 className="mt-1 text-[18px] font-semibold tracking-[-.03em]">Your registered range</h2></div><Link href="/manufacturer/products" className="text-[10px] font-semibold underline underline-offset-4">View all products</Link></div><div className="border border-line">{featured.map((model) => <Link href={`/manufacturer/products/${model.id}`} key={model.id} className="grid grid-cols-[28px_1fr_auto] items-center gap-3 border-b border-line px-4 py-4 last:border-0 hover:bg-[#f8f7f3]"><Package size={16} className="text-muted" /><div><p className="text-[12px] font-semibold">{model.name}</p><p className="mt-1 text-[10px] text-muted">{model.category} · <span className="mono">{model.id}</span></p></div><span className="flex items-center gap-2 text-[10px] text-muted">{model.units} units<ArrowUpRight size={13} /></span></Link>)}</div>
    {stats.activeRecalls > 0 && <div className="mt-9 flex flex-col justify-between gap-4 border-t border-line pt-6 sm:flex-row sm:items-center"><div><p className="eyebrow">Safety management</p><p className="mt-1 text-[13px] font-semibold">{stats.activeRecalls} active recall{stats.activeRecalls > 1 ? "s" : ""} need review.</p><p className="mt-1 text-[11px] text-muted">Affected units and owners are identified automatically.</p></div><Link href="/manufacturer/recalls" className="inline-flex items-center gap-2 border border-line px-3.5 py-2.5 text-[11px] font-semibold">Review active recalls <ArrowRight size={13} /></Link></div>}
    <div className="mt-8 flex items-center gap-2 text-[10px] text-muted"><Boxes size={14} />{demo ? `Showing ${demoProducts.length} local sample product units.` : `${stats.registeredUnits} registered product units loaded from RecallRelay.`}</div></AppShell>;
}
