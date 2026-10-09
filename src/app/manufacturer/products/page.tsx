import Link from "next/link";
import { ArrowUpRight, Package } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/page-heading";

const models = [{ id: "HC10", name: "HeatCore 10K", category: "Portable battery pack", units: 184, safety: "1 active recall" }, { id: "TR4", name: "TrailRadio 4", category: "Outdoor electronics", units: 51, safety: "No active recalls" }, { id: "FC7", name: "FieldCharge 7", category: "Portable charger", units: 51, safety: "No active recalls" }];

export default function ManufacturerProducts() {
  return <AppShell manufacturer><PageHeading eyebrow="Northstar Outdoor Tech" title="Products" description="Product models and their registered units." action={<Link href="/manufacturer/register" className="bg-ink px-4 py-2.5 text-[11px] font-semibold text-white">Register Product</Link>} /><div className="border border-line">{models.map((model) => <Link key={model.id} href={`/manufacturer/products/${model.id}`} className="grid grid-cols-[32px_1fr_auto] items-center gap-3 border-b border-line px-4 py-4 last:border-0 hover:bg-[#f8f7f3] sm:grid-cols-[36px_1.4fr_1fr_110px_20px]"><Package size={16} className="text-muted" /><div><p className="text-[12px] font-semibold">{model.name}</p><p className="mt-1 text-[10px] text-muted">{model.category} · <span className="mono">{model.id}</span></p></div><p className="hidden text-[10px] text-muted sm:block">{model.safety}</p><p className="text-right text-[10px] text-muted">{model.units} units</p><ArrowUpRight size={13} className="hidden text-muted sm:block" /></Link>)}</div></AppShell>;
}
