import { UserRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/page-heading";
import { requireOwner } from "@/lib/auth/session";
import { EnvBadge } from "@/components/env-badge";

export default async function ProfilePage() {
  const owner = await requireOwner();
  const prefs = owner.profile.notification_prefs as { safety?: boolean; transfers?: boolean } | null;

  return <AppShell workspaceName={owner.workspaceName}><PageHeading eyebrow="Personal details" title="Profile" description="Your RecallRelay profile and notification preferences." /><section className="max-w-2xl border border-line bg-paper p-5 sm:p-7"><div className="flex items-center gap-4 border-b border-line pb-5"><span className="grid size-11 place-items-center border border-line bg-[#f0eee8]"><UserRound size={18} strokeWidth={1.5} /></span><div><p className="text-[14px] font-semibold">{owner.profile.full_name}</p><p className="mt-1 text-[11px] text-muted">{owner.demo ? "Local preview profile" : owner.profile.wallet_address ? `Wallet · ${owner.profile.wallet_address.slice(0, 4)}••••${owner.profile.wallet_address.slice(-4)}` : "Wallet linked profile"}</p></div></div><div className="grid gap-5 pt-5 sm:grid-cols-2"><div><p className="eyebrow text-[9px]">Account status</p><p className="mt-2 text-[12px]">{owner.demo ? "Demo profile" : "Signed-in wallet profile"}</p></div><div><p className="eyebrow text-[9px]">Safety notifications</p><p className="mt-2 text-[12px]">{prefs?.safety === false ? "Disabled" : "Enabled"}</p></div><div><p className="eyebrow text-[9px]">Transfer notifications</p><p className="mt-2 text-[12px]">{prefs?.transfers === false ? "Disabled" : "Enabled"}</p></div><div><p className="eyebrow text-[9px]">Data environment</p><p className="mt-2"><EnvBadge /></p></div></div><p className="mt-6 border-t border-line pt-4 text-[10px] leading-5 text-muted">{owner.demo ? "Authentication and notification delivery are not connected in demo mode. This profile is illustrative local data." : "Your profile is stored in Supabase and scoped to your signed-in wallet."}</p></section></AppShell>;
}
