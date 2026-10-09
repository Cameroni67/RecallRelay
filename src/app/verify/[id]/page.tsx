import { notFound } from "next/navigation";
import { PublicHeader } from "@/components/public-header";
import { ProductPassport } from "@/components/passport";
import { findProduct } from "@/lib/data";
import { VerifiedLabel } from "@/components/verified-label";

export default async function VerifyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const product = findProduct(id);
  if (!product) notFound();
  return <main className="min-h-screen bg-paper"><PublicHeader /><div className="mx-auto max-w-[1200px] px-5 py-8 sm:px-8 sm:py-10"><div className="mb-7 flex flex-col gap-3 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow">RecallRelay public record</p><h1 className="mt-2 text-[27px] font-semibold tracking-[-.05em]">Product verification</h1></div><VerifiedLabel recalled={product.safety === "recalled"} /></div><ProductPassport product={product} publicView /></div><footer className="mt-10 border-t border-line px-5 py-5 text-center text-[10px] text-muted">This public record protects owner privacy. No personal or wallet details are shown.</footer></main>;
}
