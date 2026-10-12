"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, ArrowLeftRight, Bell, CheckCheck, Package, Loader2 } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/client";
import { severityConfig } from "@/components/severity";
import { formatDateLong } from "@/lib/db/mappers";

export type NotificationItem = {
  id: string;
  kind: string;
  severity: string | null;
  title: string;
  body: string | null;
  recall_id: string | null;
  unit_id: string | null;
  read_at: string | null;
  created_at: string;
};

function kindIcon(kind: string) {
  if (kind === "recall") return AlertTriangle;
  if (kind === "transfer") return ArrowLeftRight;
  if (kind === "registration") return Package;
  return Bell;
}

/**
 * Own-notifications list: read-only mirror of the caller's rows plus
 * mark-as-read (RLS only ever lets a caller update their OWN read_at —
 * inserts are denied for clients entirely; notifications are created by
 * database functions).
 */
export function NotificationList({
  items,
  demo = false,
}: {
  items: NotificationItem[];
  demo?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function markRead(id: string) {
    if (demo) return;
    const supabase = getBrowserClient();
    if (!supabase) return;
    setBusy(id);
    setError(null);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      setBusy(null);
      setError("Your session expired. Sign in again to manage notifications.");
      return;
    }
    const { error: updateError } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("profile_id", uid);
    setBusy(null);
    if (updateError) {
      console.error("mark notification read failed", updateError);
      setError("That notification could not be marked as read. Please try again.");
      return;
    }
    router.refresh();
  }

  async function markAllRead() {
    if (demo) return;
    const supabase = getBrowserClient();
    if (!supabase) return;
    setBusy("all");
    setError(null);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      setBusy(null);
      setError("Your session expired. Sign in again to manage notifications.");
      return;
    }
    const { error: updateError } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("profile_id", uid)
      .is("read_at", null);
    setBusy(null);
    if (updateError) {
      console.error("mark all read failed", updateError);
      setError("Notifications could not be marked as read. Please try again.");
      return;
    }
    router.refresh();
  }

  if (!items.length) {
    return (
      <div className="max-w-xl border border-line bg-paper p-7 text-center">
        <p className="text-[15px] font-semibold">No notifications</p>
        <p className="mt-2 text-[12px] leading-5 text-muted">
          Ownership changes and safety notices for products you own will appear here.
        </p>
      </div>
    );
  }

  const unreadCount = items.filter((item) => !item.read_at).length;

  return (
    <div className="max-w-3xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[11px] text-muted">
          {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
        </p>
        {unreadCount > 0 && !demo && (
          <button
            type="button"
            onClick={markAllRead}
            disabled={busy === "all"}
            className="inline-flex h-9 items-center gap-1.5 border border-line bg-paper px-3 text-[11px] font-semibold hover:border-ink disabled:opacity-60"
          >
            {busy === "all" ? <Loader2 size={13} className="animate-spin" /> : <CheckCheck size={13} />}
            Mark all as read
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mb-3 border border-[#e8c3bf] bg-[#fff8f6] px-3 py-2 text-[11px] text-urgent">
          {error}
        </p>
      )}

      <ul className="space-y-3">
        {items.map((item) => {
          const Icon = kindIcon(item.kind);
          const recall = item.kind === "recall";
          const severity = item.severity === "info" ? "advisory" : item.severity;
          const { tone } = recall ? severityConfig(severity) : { tone: "text-muted" };
          const href = item.recall_id
            ? `/app/recalls/${item.recall_id}`
            : item.unit_id
              ? `/app/products/${item.unit_id}`
              : null;
          const body = (
            <div
              className={`border p-4 ${item.read_at ? "border-line bg-paper" : "border-line bg-[#f7f6f2]"}`}
            >
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 ${recall ? tone : "text-muted"}`}>
                  <Icon size={16} strokeWidth={1.7} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13px] font-semibold">{item.title}</p>
                    {!item.read_at && (
                      <span className="text-[9px] font-bold tracking-[.1em] text-urgent">
                        UNREAD
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[12px] leading-5 text-muted">{item.body ?? ""}</p>
                  <p className="mt-2 text-[10px] text-muted">{formatDateLong(item.created_at)}</p>
                </div>
                {!item.read_at && !demo && (
                  <button
                    type="button"
                    onClick={() => markRead(item.id)}
                    disabled={busy === item.id}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 border border-line bg-paper px-2.5 text-[10px] font-semibold hover:border-ink disabled:opacity-60"
                  >
                    {busy === item.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCheck size={12} />}
                    Mark read
                  </button>
                )}
              </div>
            </div>
          );
          return (
            <li key={item.id}>
              {href ? (
                <Link href={href} className="block hover:opacity-90">
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
