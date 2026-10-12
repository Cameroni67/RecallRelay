import Link from "next/link";
import { ArrowUpRight, CheckCircle2, ClipboardList, FileEdit, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/page-heading";
import { requireManufacturer } from "@/lib/auth/session";
import { listManufacturerRecalls } from "@/lib/db/products";
import { getRecallCounts } from "@/lib/db/manufacturer";
import { demoRecall } from "@/lib/db/demo";
import { formatDateShort } from "@/lib/db/mappers";
import { SeverityMark, severityConfig } from "@/components/severity";

function StatusChip({ status }: { status: string }) {
  if (status === "closed") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-safe">
        <CheckCircle2 size={13} /> Resolved
      </span>
    );
  }
  if (status === "draft") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-muted">
        <FileEdit size={13} /> Draft
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-ink">
      <ClipboardList size={13} /> Active
    </span>
  );
}

export default async function ManufacturerRecalls() {
  const ctx = await requireManufacturer();
  const recalls = ctx.demo ? [demoRecall] : await listManufacturerRecalls(ctx.manufacturer.id);
  const counts = await Promise.all(
    recalls.map((recall) =>
      ctx.demo
        ? Promise.resolve({ affectedUnits: 1, ownersReached: 1 })
        : getRecallCounts(recall.id),
    ),
  );

  const active = recalls.filter((recall) => recall.status === "active");
  const resolved = recalls.filter((recall) => recall.status === "closed");
  const drafts = recalls.filter((recall) => recall.status === "draft");

  const card = (index: number) => {
    const recall = recalls[index];
    const count = counts[index];
    const { banner, tone, panel } = severityConfig(recall.severity);
    return (
      <Link
        key={recall.id}
        href={`/manufacturer/recalls/${recall.id}`}
        className={`block border p-4 sm:p-5 ${panel}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <SeverityMark severity={recall.severity} compact />
          <span className={`text-[10px] font-bold tracking-[.12em] ${tone}`}>{banner}</span>
          <StatusChip status={recall.status} />
          <span className="ml-auto text-[10px] text-muted">
            {formatDateShort(recall.issued_at)}
          </span>
        </div>
        <h2 className="mt-2 text-[15px] font-semibold">{recall.title}</h2>
        <p className="mt-1 text-[11px] leading-5 text-muted">{recall.required_action}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-3 text-[11px]">
          <span className="font-semibold">{count.affectedUnits} affected units</span>
          <span className="text-muted">{count.ownersReached} current owners</span>
          <span className="ml-auto inline-flex items-center gap-1 font-semibold">
            Open recall <ArrowUpRight size={13} />
          </span>
        </div>
      </Link>
    );
  };

  return (
    <AppShell manufacturer workspaceName={ctx.workspaceName}>
      <PageHeading
        eyebrow={ctx.manufacturer.name}
        title="Recalls"
        description="Safety notices issued for registered product units."
        action={
          <Link
            href="/manufacturer/recalls/new"
            className="inline-flex h-10 items-center gap-2 bg-ink px-4 text-[12px] font-semibold text-white"
          >
            <Plus size={15} /> Issue recall
          </Link>
        }
      />

      <section>
        <p className="eyebrow">Active safety notices · {active.length}</p>
        {active.length ? (
          <div className="mt-3 space-y-3">{active.map((recall) => card(recalls.indexOf(recall)))}</div>
        ) : (
          <div className="mt-3 max-w-xl border border-line bg-paper p-6">
            <p className="text-[14px] font-semibold">No active recalls</p>
            <p className="mt-1 text-[12px] text-muted">
              Nothing is currently under an active safety notice.
            </p>
          </div>
        )}
      </section>

      {drafts.length > 0 && (
        <section className="mt-8">
          <p className="eyebrow">Drafts · {drafts.length}</p>
          <div className="mt-3 space-y-3">{drafts.map((recall) => card(recalls.indexOf(recall)))}</div>
        </section>
      )}

      {resolved.length > 0 && (
        <section className="mt-8">
          <p className="eyebrow">Resolved · {resolved.length}</p>
          <div className="mt-3 space-y-3 opacity-80">
            {resolved.map((recall) => card(recalls.indexOf(recall)))}
          </div>
        </section>
      )}
    </AppShell>
  );
}
