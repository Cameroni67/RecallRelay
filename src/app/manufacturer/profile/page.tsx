import { Factory } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/page-heading";

export default function ManufacturerProfilePage() {
  return <AppShell manufacturer><PageHeading eyebrow="Workspace details" title="Profile" description="Manufacturer identity and local demo settings." /><section className="max-w-2xl border border-line bg-paper p-5 sm:p-7"><div className="flex items-center gap-4 border-b border-line pb-5"><span className="grid size-11 place-items-center border border-line bg-[#f0eee8]"><Factory size={18} strokeWidth={1.5} /></span><div><p className="text-[14px] font-semibold">Northstar Outdoor Tech</p><p className="mt-1 text-[11px] text-muted">Manufacturer workspace · Preview</p></div></div><div className="grid gap-5 pt-5 sm:grid-cols-2"><div><p className="eyebrow text-[9px]">Registered models</p><p className="mt-2 text-[12px]">3 sample product models</p></div><div><p className="eyebrow text-[9px]">Product registry</p><p className="mt-2 text-[12px]">Local preview data</p></div></div><p className="mt-6 border-t border-line pt-4 text-[10px] leading-5 text-muted">Manufacturer accounts and registration data are not connected to a backend in Phase 1.</p></section></AppShell>;
}
