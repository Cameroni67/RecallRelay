import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/page-heading";
import { TransferFlow } from "@/components/transfer-flow";
import { requireOwner } from "@/lib/auth/session";
import { findProductByIdOrSerial } from "@/lib/db/products";
import { isDemoMode } from "@/lib/db/products";

export default async function TransferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requireOwner();
  const product = await findProductByIdOrSerial(id, owner.userId);
  if (!product) notFound();
  return <AppShell workspaceName={owner.workspaceName}><PageHeading eyebrow="Product ownership" title="Transfer Product" description="Review the product and recipient before handing over its ownership record." /><TransferFlow product={product} unitId={product.id} live={!isDemoMode()} /></AppShell>;
}
