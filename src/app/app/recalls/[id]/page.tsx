import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, CheckCircle2, ClipboardList } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/page-heading";
import { SeverityMark, severityConfig } from "@/components/severity";
import { SafetyStatus } from "@/components/badges";
import { requireOwner } from "@/lib/auth/session";
import { findOwnerRecall, type OwnerRecallDetail } from "@/lib/db/products";
import { demoFindProduct, demoRecall } from "@/lib/db/demo";
import { formatDateLong } from "@/lib/db/mappers";

function StatusChip({ status }: { status: string }) {
  if (status === "closed") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-safe">
        <CheckCircle2 size={14} /> Resolved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted">
      <ClipboardList size={14} /> Active
    </span>
  );
}

function RecallDetail({
  detail,
  workspaceName,
}: {
  detail: OwnerRecallDetail;
  workspaceName: string;
}) {
  const { recall, products, manufacturerName } = detail;
  const { banner, panel } = severityConfig(recall.severity);
  const maker = manufacturerName ?? "Manufacturer";

  return (
    <AppShell workspaceName={workspaceName}>
      <PageHeading
        eyebrow={`${maker} · Safety notice`}
        title={recall.title}
        description={
          recall.issued_at ? `Issued ${formatDateLong(recall.issued_at)}` : "Safety notice"
        }
        action={
          <span className="flex flex-col items-end gap-2">
            <SeverityMark severity={recall.severity} />
            <StatusChip status={recall.status} />
          </span>
        }
      />

      <div className={`max-w-3xl border px-5 py-4 ${panel}`}>
        <p className="text-[10px] font-bold tracking-[.12em]">{banner}</p>
        <p className="mt-2 text-[14px] font-semibold">Required action</p>
        <p className="mt-1 text-[13px] leading-6">{recall.required_action}</p>
        {recall.description && (
          <p className="mt-3 border-t border-line pt-3 text-[12px] leading-6 text-muted">
            {recall.description}
          </p>
        )}
      </div>

      <section className="mt-7 max-w-3xl">
        <p className="eyebrow">Affected products you own</p>
        {products.length ? (
          <div className="mt-3 space-y-3">
            {products.map((product) => (
              <Link
                key={product.id}
                href={`/app/products/${product.id}`}
                className="block border border-line bg-paper p-4 hover:border-ink"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-semibold">{product.name}</p>
                    <p className="mono mt-1 text-[11px] text-muted">{product.serial}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <SafetyStatus
                      recalled={product.safety === "recalled"}
                      severity={recall.severity}
                      compact
                    />
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold">
                      View product passport <ArrowUpRight size={13} />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-3 border border-line bg-paper p-4 text-[12px] text-muted">
            You no longer own an affected unit — this notice is kept for your records.
          </p>
        )}
      </section>

      <section className="mt-7 max-w-3xl border-t border-line pt-5">
        <p className="eyebrow">What happens next</p>
        <p className="mt-2 max-w-xl text-[12px] leading-6 text-muted">
          Follow the required action above. The manufacturer may issue updates or resolve this recall — you will get a
          notification when its status changes. Recall status and history are stored with the product, so this
          information stays with the unit even after you transfer it.
        </p>
      </section>
    </AppShell>
  );
}

export default async function OwnerRecallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const owner = await requireOwner();

  if (owner.demo) {
    if (id !== demoRecall.id) notFound();
    const product = demoFindProduct("HC10-2048");
    return (
      <RecallDetail
        workspaceName={owner.workspaceName}
        detail={{
          recall: demoRecall,
          products: product ? [product] : [],
          manufacturerName: "Northstar Outdoor Tech",
        }}
      />
    );
  }

  const detail = await findOwnerRecall(owner.userId, id);
  if (!detail) notFound();
  return <RecallDetail workspaceName={owner.workspaceName} detail={detail} />;
}
