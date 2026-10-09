import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/supabase/env";
import { EnvBadge } from "@/components/env-badge";
import { OnboardingForm } from "./form";

export default async function OnboardingPage() {
  if (!getPublicEnv().databaseConfigured) redirect("/app/products");

  const supabase = await getServerClient();
  if (!supabase) redirect("/signin");

  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profile) redirect("/app/products");

  return (
    <main className="min-h-screen bg-paper">
      <header className="mx-auto flex h-[58px] max-w-[1040px] items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-[-.04em]">
          <span className="grid size-7 place-items-center bg-ink text-white">
            <span className="text-[13px]">r</span>
          </span>
          RecallRelay
        </Link>
        <EnvBadge />
      </header>
      <div className="mx-auto max-w-[420px] px-5 pb-20 pt-14">
        <p className="eyebrow">Step 1 of 2</p>
        <h1 className="mt-3 text-[28px] font-semibold tracking-[-.05em]">Create your owner profile</h1>
        <p className="mt-3 text-[13px] leading-6 text-muted">
          Your wallet is already linked. Add the name other owners will see
          during transfers.
        </p>
        <section className="mt-8 border border-line bg-paper p-5">
          <OnboardingForm mode="owner" />
        </section>
      </div>
    </main>
  );
}
