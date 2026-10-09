import Link from "next/link";
import { ArrowUpRight, Package } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/page-heading";
import { requireManufacturer } from "@/lib/auth/session";
import { listModels } from "@/lib/db/manufacturer";

export default async function ManufacturerProducts() {
  const ctx = await requireManufacturer();
  const models = await listModels(ctx.manufacturer.id);

  return <AppShell manufacturer workspaceName={ctx.workspaceName}><PageHeading eyebrow={ctx.manufacturer.name} title="Products" description="Product models and their registered units." action={<Link href="/manufacturer/register" className="bg-ink px-4 py-2.5 text-[11px] font-semibold text-white">Register Product</Link>} /><div className="border border-line">{models.map((model) => <Link key={model.id} href={`/manufacturer/products/${model.id}`} className="grid grid-cols-[32px_1fr_auto] items-center gap-3 border-b border-line px-4 py-4 last:border-0 hover:bg-[#f8f7f3] sm:grid-cols-[36px_1.4fr_1fr_110px_20px]"><Package size={16} className="text-muted" /><div><p className="text-[12px] font-semibold">{model.name}</p><p className="mt-1 text-[10px] text-muted">{model.category} · <span className="mono">{model.id}</span></p></div><p className="hidden text-[10px] text-muted sm:block">{model.safety}</p><p className="text-right text-[10px] text-muted">{model.units} units</p><ArrowUpRight size={13} className="hidden text-muted sm:block" /></Link>)}</div></AppShell>;
}
