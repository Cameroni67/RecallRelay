import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/page-heading";
import { TransferFlow } from "@/components/transfer-flow";
import { findProduct } from "@/lib/data";

export default async function TransferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const product = findProduct(id);
  if (!product) notFound();
  return <AppShell><PageHeading eyebrow="Product ownership" title="Transfer Product" description="Review the product and recipient before handing over its ownership record." /><TransferFlow product={product} /></AppShell>;
}
