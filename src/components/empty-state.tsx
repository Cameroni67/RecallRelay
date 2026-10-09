import { PackageOpen } from "lucide-react";
import Link from "next/link";
export function EmptyState({ title, description, action, href }: { title: string; description: string; action?: string; href?: string }) {
  return <div className="flex min-h-[250px] flex-col items-center justify-center border border-dashed border-[#cecec8] px-6 py-12 text-center"><PackageOpen size={22} strokeWidth={1.4} className="text-muted" /><h2 className="mt-4 text-[16px] font-semibold tracking-[-.02em]">{title}</h2><p className="mt-2 max-w-sm text-[12px] leading-5 text-muted">{description}</p>{action && href && <Link href={href} className="mt-5 border border-ink px-4 py-2.5 text-[12px] font-semibold hover:bg-ink hover:text-white">{action}</Link>}</div>;
}
