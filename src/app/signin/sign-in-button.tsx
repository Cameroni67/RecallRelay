"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Wallet } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/client";

type SolanaProvider = {
  isConnected?: boolean;
  signMessage?: (message: Uint8Array, display?: string) => Promise<{ signature: Uint8Array }>;
};

function getSolanaProvider(): SolanaProvider | null {
  const w = window as unknown as {
    phantom?: { solana?: SolanaProvider };
    solana?: SolanaProvider;
  };
  return w.phantom?.solana ?? w.solana ?? null;
}

export function SignInButton() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "working">("idle");
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setError(null);
    const supabase = getBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured in this environment.");
      return;
    }
    const provider = getSolanaProvider();
    if (!provider) {
      setError("Phantom wallet not found. Install Phantom, then reload this page.");
      return;
    }

    setStatus("working");
    try {
      const { error: signInError } = await supabase.auth.signInWithWeb3({
        chain: "solana",
        statement: "Sign in to RecallRelay to verify product ownership.",
        wallet: provider as never,
      });
      if (signInError) {
        setStatus("idle");
        setError(signInError.message.includes("rejected") ? "Sign-in was cancelled." : signInError.message);
        return;
      }

      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        setStatus("idle");
        setError("Sign-in did not complete. Please try again.");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", data.user.id)
        .maybeSingle();
      router.push(profile ? "/app/products" : "/onboarding");
      router.refresh();
    } catch (cause) {
      setStatus("idle");
      setError(cause instanceof Error ? cause.message : "Sign-in failed. Please try again.");
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={signIn}
        disabled={status === "working"}
        className="inline-flex h-11 w-full items-center justify-center gap-2 bg-ink px-4 text-[12px] font-semibold text-white hover:bg-[#303234] disabled:opacity-60"
      >
        {status === "working" ? <Loader2 size={15} className="animate-spin" /> : <Wallet size={15} />}
        {status === "working" ? "Waiting for wallet…" : "Continue with Phantom"}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-[11px] text-urgent">
          {error}
        </p>
      )}
      <p className="mt-4 text-[11px] leading-5 text-muted">
        Your wallet address becomes your RecallRelay identity. Existing product
        ownership is matched to the same address.
      </p>
    </div>
  );
}
