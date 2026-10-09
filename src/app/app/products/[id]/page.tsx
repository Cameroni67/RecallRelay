import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ProductPassport } from "@/components/passport";
import { findProduct } from "@/lib/data";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const product = findProduct(id);
  if (!product) notFound();
  return <AppShell><div className="mb-6 flex items-center justify-between"><p className="eyebrow">Product passport</p><a href={`/verify/${product.id}`} className="text-[11px] font-semibold underline underline-offset-4">Public verification</a></div><ProductPassport product={product} /></AppShell>;
}
