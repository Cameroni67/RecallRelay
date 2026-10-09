import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/page-heading";
import { ProductPassport } from "@/components/passport";
import { findProduct } from "@/lib/data";

export default async function ManufacturerUnitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const product = findProduct(id); if (!product) notFound();
  return <AppShell manufacturer><PageHeading eyebrow="Registered unit" title={product.name} description={`Unit record · ${product.serial}`} action={<Link href={`/verify/${product.id}`} className="inline-flex items-center gap-1 text-[10px] font-semibold underline underline-offset-4">Public record <ArrowUpRight size={12} /></Link>} /><ProductPassport product={product} /></AppShell>;
}
