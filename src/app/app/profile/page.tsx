import { UserRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/page-heading";

export default function ProfilePage() {
  return <AppShell><PageHeading eyebrow="Personal details" title="Profile" description="Your local demo profile and notification preferences." /><section className="max-w-2xl border border-line bg-paper p-5 sm:p-7"><div className="flex items-center gap-4 border-b border-line pb-5"><span className="grid size-11 place-items-center border border-line bg-[#f0eee8]"><UserRound size={18} strokeWidth={1.5} /></span><div><p className="text-[14px] font-semibold">Bob Chen</p><p className="mt-1 text-[11px] text-muted">Local preview profile</p></div></div><div className="grid gap-5 pt-5 sm:grid-cols-2"><div><p className="eyebrow text-[9px]">Account status</p><p className="mt-2 text-[12px]">Demo profile</p></div><div><p className="eyebrow text-[9px]">Safety notifications</p><p className="mt-2 text-[12px]">Enabled in this preview</p></div></div><p className="mt-6 border-t border-line pt-4 text-[10px] leading-5 text-muted">Authentication and notification delivery are not connected in Phase 1. This profile is illustrative local data.</p></section></AppShell>;
}
