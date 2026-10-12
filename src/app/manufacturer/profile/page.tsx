import { Factory } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/page-heading";
import { requireManufacturer } from "@/lib/auth/session";
import { listModels } from "@/lib/db/manufacturer";
import { EnvBadge } from "@/components/env-badge";
import { ManufacturerChainPanel } from "@/components/manufacturer-chain-panel";
import { observeManufacturer } from "@/lib/solana/chain";

export default async function ManufacturerProfilePage() {
  const ctx = await requireManufacturer();
  const models = await listModels(ctx.manufacturer.id);
  // Read the manufacturer's on-chain account directly; the panel only shows
  // what the server observed, never what a client claims.
  let chainStatus: "unregistered" | "synced" = "unregistered";
  let chainPda: string | null = null;
  if (!ctx.demo) {
    try {
      const observed = await observeManufacturer(ctx.manufacturer.id);
      if (observed) {
        chainStatus = "synced";
        chainPda = observed.pda;
      }
    } catch {
      chainStatus = "unregistered";
    }
  }
  return <AppShell manufacturer workspaceName={ctx.workspaceName}><PageHeading eyebrow="Workspace details" title="Profile" description="Manufacturer identity and workspace settings." /><section className="max-w-2xl border border-line bg-paper p-5 sm:p-7"><div className="flex items-center gap-4 border-b border-line pb-5"><span className="grid size-11 place-items-center border border-line bg-[#f0eee8]"><Factory size={18} strokeWidth={1.5} /></span><div><p className="text-[14px] font-semibold">{ctx.manufacturer.name}</p><p className="mt-1 text-[11px] text-muted">Manufacturer workspace · {ctx.manufacturer.verified ? "Verified" : "Unverified"} · Your role: {ctx.manufacturer.role}</p></div></div><div className="grid gap-5 pt-5 sm:grid-cols-2"><div><p className="eyebrow text-[9px]">Registered models</p><p className="mt-2 text-[12px]">{models.length} product models</p></div><div><p className="eyebrow text-[9px]">Workspace slug</p><p className="mono mt-2 text-[12px]">{ctx.manufacturer.slug}</p></div><div><p className="eyebrow text-[9px]">Data environment</p><p className="mt-2"><EnvBadge /></p></div></div><p className="mt-6 border-t border-line pt-4 text-[10px] leading-5 text-muted">{ctx.demo ? "Manufacturer accounts and registration data are not connected to a backend in demo mode." : "Your workspace, members, and product records are stored in Supabase and protected by row-level security."}</p><ManufacturerChainPanel manufacturerId={ctx.manufacturer.id} live={!ctx.demo} initialStatus={chainStatus} initialPda={chainPda} sessionWallet={ctx.profile.wallet_address} /></section></AppShell>;
}
