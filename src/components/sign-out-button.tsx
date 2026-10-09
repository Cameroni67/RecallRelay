"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/client";

export function SignOutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();

  async function signOut() {
    const supabase = getBrowserClient();
    if (supabase) await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      className={`flex items-center gap-2 px-3 py-2 text-[11px] text-muted hover:text-ink ${compact ? "" : "w-full"}`}
    >
      <LogOut size={13} />
      Sign out
    </button>
  );
}
