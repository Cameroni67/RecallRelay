import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/supabase/env";
import { EnvBadge } from "@/components/env-badge";
import { SignInButton } from "./sign-in-button";

export default async function SignInPage() {
  const env = getPublicEnv();
  const supabase = env.databaseConfigured ? await getServerClient() : null;

  if (supabase) {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", data.user.id)
        .maybeSingle();
      redirect(profile ? "/app/products" : "/onboarding");
    }
  }

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
        <p className="eyebrow">Owner &amp; manufacturer access</p>
        <h1 className="mt-3 text-[30px] font-semibold tracking-[-.05em]">Sign in with your wallet</h1>
        <p className="mt-3 text-[13px] leading-6 text-muted">
          RecallRelay uses Solana Sign-In with Solana (SIWS). Your wallet is your
          account — no email or password.
        </p>

        <section className="mt-8 border border-line bg-paper p-5">
          {!env.databaseConfigured ? (
            <>
              <p className="text-[12px] font-semibold">Demo data mode</p>
              <p className="mt-2 text-[12px] leading-5 text-muted">
                Supabase is not configured in this environment, so sign-in is
                disabled and workspaces show demo data.
              </p>
              <Link
                href="/app/products"
                className="mt-5 inline-flex h-10 items-center bg-ink px-4 text-[12px] font-semibold text-white hover:bg-[#303234]"
              >
                Continue in demo mode
              </Link>
            </>
          ) : (
            <SignInButton />
          )}
        </section>

        <p className="mt-6 text-[11px] leading-5 text-muted">
          Wallet signatures are used only to prove you control the address. No
          transactions are sent or funds moved during sign-in.
        </p>
      </div>
    </main>
  );
}
