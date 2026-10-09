"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, ArrowLeftRight, Factory, Package, UserRound, Boxes, Menu, X, ChevronDown } from "lucide-react";
import { useState } from "react";
import { ownerNav, manufacturerNav } from "@/lib/data";
import { EnvBadge } from "@/components/env-badge";
import { SignOutButton } from "@/components/sign-out-button";

const icons = { package: Package, transfer: ArrowLeftRight, alert: AlertTriangle, user: UserRound, unit: Boxes };

export function AppShell({ children, manufacturer = false, title, workspaceName }: { children: React.ReactNode; manufacturer?: boolean; title?: string; workspaceName?: string }) {
  const path = usePathname(); const [open, setOpen] = useState(false); const links = manufacturer ? manufacturerNav : ownerNav;
  const workspace = workspaceName ?? (manufacturer ? "Northstar Outdoor Tech" : "Bob Chen");
  return <div className="min-h-screen bg-paper">
    <header className="sticky top-0 z-30 flex h-[58px] items-center justify-between border-b border-line bg-paper px-4 sm:px-7 lg:hidden"><Link href="/" className="flex items-center gap-2 font-semibold tracking-[-.04em]"><span className="grid size-7 place-items-center bg-ink text-white"><span className="text-[13px]">r</span></span>RecallRelay</Link><button aria-label={open ? "Close navigation" : "Open navigation"} onClick={() => setOpen(!open)} className="p-2">{open ? <X size={19} /> : <Menu size={19} />}</button></header>
    <div className="mx-auto flex min-h-screen max-w-[1600px]">
      <aside className={`${open ? "fixed inset-x-0 top-[58px] z-20 block border-b border-line bg-paper px-5 pb-5" : "hidden"} w-full shrink-0 lg:sticky lg:top-0 lg:block lg:h-screen lg:w-[236px] lg:border-r lg:border-line lg:px-5 lg:py-6`}>
        <Link href="/" className="hidden items-center gap-2.5 px-1 font-semibold tracking-[-.04em] lg:flex"><span className="grid size-[29px] place-items-center bg-ink text-white"><span className="text-sm">r</span></span>RecallRelay</Link>
        <div className="mb-4 mt-8 border-b border-line pb-4 lg:mb-7 lg:mt-12"><p className="eyebrow px-2">Workspace</p><Link href={manufacturer ? "/manufacturer" : "/app/products"} className="mt-3 flex items-center justify-between px-2 text-[12px] font-semibold"><span className="flex items-center gap-2.5">{manufacturer ? <Factory size={15} /> : <UserRound size={15} />}{workspace}</span><ChevronDown size={14} className="text-muted" /></Link><p className="pl-[34px] pt-1 text-[10px] text-muted">{manufacturer ? "Manufacturer workspace" : "Owner account"}</p></div>
        <nav aria-label={manufacturer ? "Manufacturer navigation" : "Owner navigation"} className="space-y-1">{links.map((item) => { const Icon = icons[item.icon]; const active = path === item.href || (item.href === "/manufacturer/products" && path === "/manufacturer") || (path.startsWith(item.href + "/")); return <Link onClick={() => setOpen(false)} key={item.label} href={item.href} aria-current={active ? "page" : undefined} className={`flex h-10 items-center gap-3 px-3 text-[12px] font-medium transition-colors ${active ? "bg-[#eeede8] text-ink" : "text-muted hover:bg-[#f3f2ee] hover:text-ink"}`}><Icon size={16} strokeWidth={1.7} />{item.label}{item.label === "Recalls" && !manufacturer && <span className="ml-auto flex size-5 items-center justify-center bg-[#f8e7e4] text-[10px] font-semibold text-urgent">1</span>}</Link>})}</nav>
        <div className="mt-9 border-t border-line pt-5"><Link href="/" className="flex items-center gap-2 px-3 py-2 text-[11px] text-muted hover:text-ink">← Return to public site</Link><Link href={manufacturer ? "/app/products" : "/manufacturer"} className="flex items-center gap-2 px-3 py-2 text-[11px] text-muted hover:text-ink">Switch to {manufacturer ? "owner" : "manufacturer"} view <ArrowLeftRight size={13} /></Link></div>
        <div className="mt-8 border-t border-line pt-4"><p className="px-2 text-[10px] text-muted">RECALLRELAY DATA</p><p className="px-2 pt-2"><EnvBadge /></p><p className="px-2 pt-2 text-[10px] text-muted">Environment badge for local, hosted, or demo data.</p><div className="px-1 pt-2"><SignOutButton /></div></div>
      </aside>
      <main className="min-w-0 flex-1 px-4 pb-12 pt-7 sm:px-7 sm:pt-9 lg:px-10 lg:pt-10"><div className="mx-auto max-w-[1040px]">{title && <div className="mb-7 border-b border-line pb-5"><p className="eyebrow">{manufacturer ? "Manufacturer" : "Owner workspace"}</p><h1 className="mt-2 text-[28px] font-semibold tracking-[-.05em]">{title}</h1></div>}{children}</div></main>
    </div>
  </div>;
}
