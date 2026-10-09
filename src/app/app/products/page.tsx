import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/page-heading";
import { ProductCard } from "@/components/product-card";
import { EmptyState } from "@/components/empty-state";
import { requireOwner } from "@/lib/auth/session";
import { getOwnedProducts } from "@/lib/db/products";
import { isDemoMode } from "@/lib/db/products";

export default async function ProductsPage() {
  const owner = await requireOwner();
  const products = await getOwnedProducts(owner.userId);
  const demo = isDemoMode();

  return <AppShell workspaceName={owner.workspaceName}><PageHeading eyebrow="Your product library" title="My Products" description="Product passports for the things you own." action={<Link href="/verify/HC10-2048" className="flex items-center gap-1.5 text-[11px] font-semibold underline underline-offset-4">Verify a product <ArrowRight size={13} /></Link>} />
    <div className="mb-5 flex items-center justify-between text-[11px] text-muted"><span>{products.length} product passports</span><span>Sorted by recently updated</span></div>
    {products.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <EmptyState title="Your product passports will appear here." description="When a product is registered or transferred to you, its ownership and safety record will be ready here." action="Explore product records" href="/verify/HC10-2048" />}
    <div className="mt-9 border-t border-line pt-5"><p className="eyebrow">{demo ? "Demo collection" : "Live records"}</p><p className="mt-2 text-[11px] text-muted">{demo ? "Showing local sample records. The recalled HeatCore is included to preview current-owner safety alerts." : "Product passports loaded from your RecallRelay profile."}</p></div>
  </AppShell>;
}
