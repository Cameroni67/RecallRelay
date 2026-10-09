import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Product } from "@/lib/data";
import { ProductArt } from "@/components/product-art";
import { SafetyStatus } from "@/components/badges";

export function ProductCard({ product }: { product: Product }) {
  return <Link href={`/app/products/${product.id}`} className="group block border border-line bg-paper transition-colors hover:border-[#aaa9a2] focus-visible:outline-offset-4">
    <ProductArt src={product.image} alt={`${product.name} product view`} className="h-[188px] border-b border-line bg-[#eeede8] sm:h-[208px]" />
    <div className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3"><div><p className="eyebrow text-[9px]">{product.maker}</p><h3 className="mt-1.5 text-lg font-semibold tracking-[-.035em]">{product.name}</h3></div><ArrowUpRight size={16} className="mt-1 text-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></div>
      <p className="mono mt-3 text-[11px] text-muted">{product.serial}</p>
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3"><SafetyStatus recalled={product.safety === "recalled"} compact /><span className="text-[11px] text-muted">{product.safety === "transferred" ? "Previous owner" : product.owner === "You" ? "Owned by you" : `Owned by ${product.owner}`}</span></div>
    </div>
  </Link>;
}
