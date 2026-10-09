import Link from "next/link";
import { AlertTriangle, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/page-heading";
import { primaryProduct, products } from "@/lib/data";

export default function OwnerRecallsPage() {
  const recalls = products.filter((product) => product.safety === "recalled");
  return <AppShell><PageHeading eyebrow="Safety notices for your products" title="Recalls" description="Safety information follows the products you currently own." />
    {recalls.length ? <div className="space-y-3">{recalls.map((product) => <Link key={product.id} href={`/app/products/${product.id}`} className="block border border-[#e8c3bf] bg-[#fff8f6] p-4 sm:p-5"><div className="flex items-start gap-3"><span className="mt-0.5 text-urgent"><AlertTriangle size={17} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-[10px] font-bold tracking-[.12em] text-urgent">URGENT RECALL</p><span className="text-[10px] text-muted">Oct 9, 2026</span></div><h2 className="mt-2 text-[15px] font-semibold">HeatCore 10K — Battery overheating risk</h2><p className="mt-1 text-[11px] leading-5 text-muted">Stop using immediately. Affected product: {product.serial}.</p><p className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-urgent">View product and instructions <ArrowUpRight size={13} /></p></div></div></Link>)}</div> : <div className="border border-line p-6"><div className="flex items-center gap-2 text-safe"><CheckCircle2 size={18} /><h2 className="text-[15px] font-semibold">No active recalls</h2></div><p className="mt-2 text-[12px] text-muted">All registered products currently have a clear safety status.</p></div>}
    <div className="mt-8 border-t border-line pt-5"><p className="eyebrow">How recall notices work</p><p className="mt-2 max-w-xl text-[12px] leading-5 text-muted">If an item changes hands, safety notices follow its latest ownership record. Previous owners remain in product history.</p><Link href={`/app/products/${primaryProduct.id}`} className="mt-3 inline-block text-[11px] font-semibold underline underline-offset-4">View recalled product passport</Link></div>
  </AppShell>;
}
