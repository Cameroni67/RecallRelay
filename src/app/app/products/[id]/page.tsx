import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ProductPassport } from "@/components/passport";
import { requireOwner } from "@/lib/auth/session";
import { findProductByIdOrSerial, getUnitTimeline } from "@/lib/db/products";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requireOwner();
  const product = await findProductByIdOrSerial(id, owner.userId);
  if (!product) notFound();
  const timeline = await getUnitTimeline(product.id);
  return <AppShell workspaceName={owner.workspaceName}><div className="mb-6 flex items-center justify-between"><p className="eyebrow">Product passport</p><a href={`/verify/${product.serial}`} className="text-[11px] font-semibold underline underline-offset-4">Public verification</a></div><ProductPassport product={product} entries={timeline} /></AppShell>;
}
