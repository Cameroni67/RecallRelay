import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/page-heading";
import { requireManufacturer } from "@/lib/auth/session";
import { getModelById, getRecallCounts } from "@/lib/db/manufacturer";
import {
  findManufacturerRecall,
  firstUnitSerialForModel,
} from "@/lib/db/products";
import { demoModels, demoRecall } from "@/lib/db/demo";
import { formatDateLong } from "@/lib/db/mappers";
import { SeverityMark, severityConfig } from "@/components/severity";
import { RecallResolveButton } from "@/components/recall-resolve-button";

function StatusChip({ status }: { status: string }) {
  if (status === "closed") {
    return (
      <span className="inline-flex items-center gap-1.5 border border-line bg-paper px-3 py-2 text-[10px] font-bold text-safe">
        RESOLVED
      </span>
    );
  }
  if (status === "draft") {
    return (
      <span className="inline-flex items-center gap-1.5 border border-line bg-paper px-3 py-2 text-[10px] font-bold text-muted">
        DRAFT
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 border border-line bg-paper px-3 py-2 text-[10px] font-bold text-ink">
      ACTIVE
    </span>
  );
}

type DetailProps = {
  workspaceName: string;
  title: string;
  severity: string;
  status: string;
  requiredAction: string;
  description: string | null;
  issuedAt: string | null;
  manufacturerName: string;
  model: { name: string; sku: string; href: string } | null;
  affectedUnits: number;
  currentOwners: number;
  publicHref: string | null;
  recallId: string;
  live: boolean;
};

function RecallDetail(props: DetailProps) {
  const { banner, tone, panel } = severityConfig(props.severity);
  return (
    <AppShell manufacturer workspaceName={props.workspaceName}>
      <PageHeading
        eyebrow={`Recall detail · ${props.manufacturerName}`}
        title={props.title}
        description={`Product safety notice${props.issuedAt ? ` · Issued ${formatDateLong(props.issuedAt)}` : ""}`}
        action={
          <span className="flex items-center gap-2">
            <SeverityMark severity={props.severity} />
            <StatusChip status={props.status} />
          </span>
        }
      />

      <section role="alert" className={`border p-5 sm:p-6 ${panel}`}>
        <p className={`text-[10px] font-bold tracking-[.12em] ${tone}`}>
          REQUIRED ACTION · {banner}
        </p>
        <h2 className="mt-2 text-[19px] font-semibold">{props.requiredAction}</h2>
        {props.description && (
          <p className="mt-2 max-w-xl text-[12px] leading-6 text-muted">{props.description}</p>
        )}
      </section>

      <div className="mt-6 grid border border-line sm:grid-cols-2">
        <div className="border-b border-line p-4 sm:border-r">
          <p className="eyebrow">Affected model</p>
          {props.model ? (
            <Link
              href={props.model.href}
              className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold underline underline-offset-4"
            >
              {props.model.name} · {props.model.sku} <ArrowUpRight size={13} />
            </Link>
          ) : (
            <p className="mt-2 text-[13px] font-semibold">Model unavailable</p>
          )}
        </div>
        <div className="border-b border-line p-4">
          <p className="eyebrow">Affected registered units</p>
          <p className="mt-2 text-[19px] font-semibold">{props.affectedUnits}</p>
        </div>
        <div className="border-b border-line p-4 sm:border-b-0 sm:border-r">
          <p className="eyebrow">Current owners</p>
          <p className="mt-2 text-[19px] font-semibold">{props.currentOwners}</p>
          <p className="mt-1 text-[10px] text-muted">Distinct owners of affected units</p>
        </div>
        <div className="p-4">
          <p className="eyebrow">Issued</p>
          <p className="mt-2 text-[13px] font-semibold">
            {props.issuedAt ? formatDateLong(props.issuedAt) : "—"}
          </p>
          <p className="mt-1 text-[10px] text-muted">Published by {props.manufacturerName}</p>
        </div>
      </div>

      {props.publicHref && (
        <p className="mt-4 text-[11px] text-muted">
          Public verification (safe to share — no owner details):{" "}
          <Link
            href={props.publicHref}
            className="font-semibold text-ink underline underline-offset-4"
          >
            {props.publicHref}
          </Link>
        </p>
      )}

      <div className="mt-7 border-t border-line pt-5">
        <RecallResolveButton recallId={props.recallId} live={props.live && props.status === "active"} />
        <p className="mt-4 flex items-start gap-2 text-[11px] leading-5 text-muted">
          <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-safe" aria-hidden />
          {props.status === "closed"
            ? "This recall is resolved. It stays on the product’s record and timeline as history — current owners were notified of the resolution."
            : "Resolving notifies current owners only, marks the recall Resolved everywhere, and keeps it visible in history."}
        </p>
      </div>
    </AppShell>
  );
}

export default async function ManufacturerRecallDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireManufacturer();

  if (ctx.demo) {
    if (id !== demoRecall.id) notFound();
    const demoModel = demoModels.find((model) => model.id === demoRecall.model_id);
    return (
      <RecallDetail
        workspaceName={ctx.workspaceName}
        title={demoRecall.title}
        severity={demoRecall.severity}
        status={demoRecall.status}
        requiredAction={demoRecall.required_action}
        description={demoRecall.description ?? null}
        issuedAt={demoRecall.issued_at ?? null}
        manufacturerName="Northstar Outdoor Tech"
        model={
          demoModel
            ? {
                name: demoModel.name,
                sku: demoModel.id,
                href: `/manufacturer/products/${demoModel.id}`,
              }
            : null
        }
        affectedUnits={1}
        currentOwners={1}
        publicHref="/verify/HC10-2048"
        recallId={demoRecall.id}
        live={false}
      />
    );
  }

  const recall = await findManufacturerRecall(id, ctx.manufacturer.id);
  if (!recall) notFound();

  const [counts, model, publicSerial] = await Promise.all([
    getRecallCounts(recall.id),
    recall.model_id ? getModelById(recall.model_id) : Promise.resolve(null),
    recall.model_id ? firstUnitSerialForModel(recall.model_id) : Promise.resolve(null),
  ]);

  return (
    <RecallDetail
      workspaceName={ctx.workspaceName}
      title={recall.title}
      severity={recall.severity}
      status={recall.status}
      requiredAction={recall.required_action}
      description={recall.description ?? null}
      issuedAt={recall.issued_at ?? null}
      manufacturerName={ctx.manufacturer.name}
      model={
        model
          ? {
              name: model.name,
              sku: model.sku,
              href: `/manufacturer/products/${model.sku}`,
            }
          : null
      }
      affectedUnits={counts.affectedUnits}
      currentOwners={counts.ownersReached}
      publicHref={publicSerial ? `/verify/${publicSerial}` : null}
      recallId={recall.id}
      live
    />
  );
}
