"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/client";

export function OnboardingForm({ mode }: { mode: "owner" | "manufacturer" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    const supabase = getBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured in this environment.");
      return;
    }
    setWorking(true);
    setError(null);

    try {
      if (mode === "owner") {
        const { error: rpcError } = await supabase.rpc("create_profile", {
          p_full_name: trimmed,
        });
        if (rpcError) {
          setWorking(false);
          setError(
            rpcError.message.includes("profile already exists")
              ? "You already have a profile."
              : rpcError.message,
          );
          return;
        }
        router.push("/app/products");
      } else {
        const slug = slugify(trimmed);
        const { error: rpcError } = await supabase.rpc("create_manufacturer", {
          p_name: trimmed,
          p_slug: slug,
        });
        if (rpcError) {
          setWorking(false);
          setError(
            rpcError.message.includes("slug already in use")
              ? "That company name is already registered. Try a variation."
              : rpcError.message,
          );
          return;
        }
        router.push("/manufacturer");
      }
      router.refresh();
    } catch (cause) {
      setWorking(false);
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    }
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor="workspace-name" className="text-[12px] font-semibold">
        {mode === "owner" ? "Your name" : "Company name"}
      </label>
      <input
        required
        id="workspace-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={mode === "owner" ? "e.g. Alex Rivera" : "e.g. Northstar Outdoor Tech"}
        maxLength={80}
        className="mt-2 block h-11 w-full border border-line bg-paper px-3 text-[12px] placeholder:text-[#9b9d99] focus:border-blue focus:outline-none"
      />
      <button
        type="submit"
        disabled={working}
        className="mt-6 inline-flex h-10 items-center gap-2 bg-ink px-4 text-[12px] font-semibold text-white hover:bg-[#303234] disabled:opacity-60"
      >
        {working && <Loader2 size={14} className="animate-spin" />}
        {mode === "owner" ? "Create profile" : "Create workspace"}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-[11px] text-urgent">
          {error}
        </p>
      )}
    </form>
  );
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
