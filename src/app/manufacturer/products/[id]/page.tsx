import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/page-heading";
import { ProductArt } from "@/components/product-art";
import { requireManufacturer } from "@/lib/auth/session";
import { getModelBySku } from "@/lib/db/manufacturer";
import { listUnitsForModel } from "@/lib/db/products";
import { demoModels } from "@/lib/db/demo";
import type { Product } from "@/lib/data";

export default async function ProductModelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireManufacturer();
  const sku = id.toUpperCase();

  let modelName: string;
  let category: string;
  let image: string;
  let unitCount: number;
  let units: Product[];

  if (ctx.demo) {
    const demoModel = demoModels.find((model) => model.id === sku);
    if (!demoModel) notFound();
    units = await listUnitsForModel(sku, ctx.userId, sku);
    modelName = demoModel.name;
    category = demoModel.category;
    image = demoModel.image;
    unitCount = demoModel.units;
  } else {
    const model = await getModelBySku(sku);
    if (!model) notFound();
    units = await listUnitsForModel(model.id, ctx.userId);
    modelName = model.name;
    category = model.category;
    image = model.image_path;
    unitCount = units.length;
  }

  const activeRecalls = units.filter((unit) => unit.safety === "recalled").length;

  return <AppShell manufacturer workspaceName={ctx.workspaceName}><PageHeading eyebrow={`Product model · ${ctx.manufacturer.name}`} title={modelName} description={category} action={<Link href="/manufacturer/register" className="inline-flex items-center gap-2 bg-ink px-3.5 py-2.5 text-[10px] font-semibold text-white"><Plus size={13} /> Register Unit</Link>} />
    <div className="grid gap-5 lg:grid-cols-[220px_1fr]"><ProductArt src={image} alt={modelName} className="aspect-[1.4/1] border border-line bg-[#eeede8] lg:aspect-square" /><div className="grid border border-line sm:grid-cols-3"><div className="border-b border-line p-4 sm:border-b-0 sm:border-r"><p className="eyebrow">Model number</p><p className="mono mt-3 text-[14px]">{sku}</p></div><div className="border-b border-line p-4 sm:border-b-0 sm:border-r"><p className="eyebrow">Registered units</p><p className="mt-3 text-[22px] font-semibold">{unitCount}</p></div><div className="p-4"><p className="eyebrow">Active recalls</p><p className={`mt-3 text-[12px] font-semibold ${activeRecalls ? "text-urgent" : "text-safe"}`}>{activeRecalls ? `${activeRecalls} · Urgent` : "0"}</p></div></div></div>
    <div className="mt-9 flex items-end justify-between border-b border-line pb-3"><div><p className="eyebrow">Unit registry</p><h2 className="mt-1 text-[17px] font-semibold">Registered units</h2></div><span className="text-[10px] text-muted">{ctx.demo ? "Sample local records" : "Live records"}</span></div><div className="mt-3 border border-line">{units.length ? units.map((unit) => <Link key={unit.id} href={`/manufacturer/units/${unit.id}`} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-line px-4 py-4 last:border-0 hover:bg-[#f8f7f3] sm:grid-cols-[1fr_1fr_140px_20px]"><div><p className="mono text-[11px] font-semibold">{unit.serial}</p><p className="mt-1 text-[10px] text-muted">{unit.owner === "You" ? "Registered owner" : unit.owner === "Unowned" ? "Unassigned" : `Current owner · ${unit.owner}`}</p></div><p className="hidden text-[10px] text-muted sm:block">Registered {unit.ownerSince}</p><p className={`text-right text-[10px] font-semibold ${unit.safety === "recalled" ? "text-urgent" : "text-safe"}`}>{unit.safety === "recalled" ? "Urgent recall" : "No active recalls"}</p><ArrowUpRight size={13} className="hidden text-muted sm:block" /></Link>) : <div className="px-4 py-6 text-[11px] text-muted">No units registered for this model yet.</div>}</div></AppShell>;
}
