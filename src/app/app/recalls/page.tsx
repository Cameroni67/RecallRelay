import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/page-heading";
import { ArrowUpRight } from "lucide-react";
import { requireOwner } from "@/lib/auth/session";
import { getOwnerRecalls } from "@/lib/db/products";
import { SeverityMark, severityConfig } from "@/components/severity";
import { formatDateShort } from "@/lib/db/mappers";

export default async function OwnerRecallsPage() {
  const owner = await requireOwner();
  const recalls = await getOwnerRecalls(owner.userId);

  return (
    <AppShell workspaceName={owner.workspaceName}>
      <PageHeading
        eyebrow="Safety notices for your products"
        title="Recalls"
        description="Safety information follows the products you currently own."
      />
      {recalls.length ? (
        <div className="space-y-3">
          {recalls.map(({ product, recall }) => {
            const { banner, tone, panel } = severityConfig(recall.severity);
            return (
              <Link
                key={product.id}
                href={`/app/recalls/${recall.id}`}
                className={`block border p-4 sm:p-5 ${panel}`}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5">
                    <SeverityMark severity={recall.severity} compact />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={`text-[10px] font-bold tracking-[.12em] ${tone}`}>{banner}</p>
                      <span className="text-[10px] text-muted">
                        Issued {formatDateShort(recall.issued_at)}
                      </span>
                    </div>
                    <h2 className="mt-2 text-[15px] font-semibold">
                      {product.name} — {recall.title}
                    </h2>
                    <p className="mt-1 text-[11px] leading-5 text-muted">
                      {recall.required_action} Affected product: {product.serial}.
                    </p>
                    <p className={`mt-3 inline-flex items-center gap-1 text-[11px] font-semibold ${tone}`}>
                      View recall details <ArrowUpRight size={13} />
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="max-w-xl border border-line bg-paper p-7 text-center">
          <p className="text-[15px] font-semibold">No active recalls</p>
          <p className="mt-2 text-[12px] leading-5 text-muted">
            None of the products you currently own are affected by an active safety notice. If a manufacturer issues
            one, it appears here and you get a notification.
          </p>
        </div>
      )}
    </AppShell>
  );
}
