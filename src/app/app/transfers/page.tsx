import Link from "next/link";
import { ArrowRightLeft, ArrowUpRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/page-heading";
import { EmptyState } from "@/components/empty-state";
import { requireOwner } from "@/lib/auth/session";
import { getTransferHistory } from "@/lib/db/transfers";
import { formatDateShort } from "@/lib/db/mappers";

export default async function TransfersPage() {
  const owner = await requireOwner();
  const history = await getTransferHistory(owner.userId);

  return <AppShell workspaceName={owner.workspaceName}><PageHeading eyebrow="Product history" title="Transfers" description="Ownership handoffs recorded with the products you own." />
    {history.length ? <div className="border border-line bg-paper"><div className="grid grid-cols-[1fr_auto] gap-3 border-b border-line bg-[#f5f4f0] px-4 py-3 text-[10px] text-muted sm:grid-cols-[1fr_1.2fr_130px]"><span>PRODUCT & SERIAL</span><span>OWNERSHIP CHANGE</span><span className="hidden sm:block">DATE</span></div>{history.map((entry) => <Link key={entry.id} href={`/app/products/${entry.product.id}`} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-4 hover:bg-[#faf9f6] sm:grid-cols-[1fr_1.2fr_130px]"><div><p className="text-[12px] font-semibold">{entry.product.name}</p><p className="mono mt-1 text-[10px] text-muted">{entry.product.serial}</p></div><div className="flex items-center gap-2 text-[11px]">{entry.direction === "to" ? <><span className="text-muted">{entry.counterparty}</span><ArrowRightLeft size={13} className="text-muted" /><span className="font-semibold">You</span></> : <><span className="text-muted">You</span><ArrowRightLeft size={13} className="text-muted" /><span className="font-semibold">{entry.counterparty}</span></>}</div><div className="hidden items-center justify-between text-[11px] text-muted sm:flex">{formatDateShort(entry.transferredAt)} <ArrowUpRight size={13} /></div><p className="col-span-2 text-[10px] text-muted sm:hidden">{formatDateShort(entry.transferredAt)} · Completed</p></Link>)}</div> : <EmptyState title="No transfers recorded yet." description="When you hand a product to another owner, the handoff will appear here." action="Open a product" href="/app/products" />}
  </AppShell>;
}
