import Link from "next/link";
import { ArrowLeftRight, ArrowUpRight } from "lucide-react";
import type { Product } from "@/lib/data";
import { ProductArt } from "@/components/product-art";
import { ProductTimeline, type TimelineEntry } from "@/components/timeline";
import { QrCard } from "@/components/qr-card";
import { SafetyStatus } from "@/components/badges";
import { ChainStatusBadge, chainStatusOf } from "@/components/chain-status";
import { severityConfig, SeverityMark } from "@/components/severity";
import { formatDateLong } from "@/lib/db/mappers";
import { siteOrigin } from "@/lib/site";

/**
 * The Product Passport. The recall banner is driven by REAL recall data
 * (`product.recall`, server-derived from Supabase): title, severity, required
 * action, manufacturer, issued date and a details CTA. Solana chain state
 * stays visible but secondary.
 */
export function ProductPassport({
  product,
  entries,
}: {
  product: Product;
  entries?: TimelineEntry[];
}) {
  const recall = product.recall ?? null;
  const recalled = product.safety === "recalled";
  const severity = recall?.severity ?? "urgent";
  const { banner, tone, panel } = severityConfig(severity);
  const origin = siteOrigin();

  return (
    <div className="page-in">
      {recall && (
        <section
          role="alert"
          className={`mb-6 flex flex-col gap-4 border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 ${panel}`}
        >
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 ${tone}`}>
              <SeverityMark severity={severity} compact />
            </span>
            <div>
              <h2 className={`text-[15px] font-bold tracking-[-.02em] ${tone}`}>{banner}</h2>
              <p className="mt-1 text-[13px] font-semibold">{recall.title}</p>
              <p className="mt-1 text-[12px] leading-5 text-muted">
                <span className="font-semibold text-ink">Required action:</span> {recall.requiredAction}
              </p>
              <p className="mt-1 text-[11px] text-muted">
                {product.maker}
                {recall.issuedAt ? <> · Issued {formatDateLong(recall.issuedAt)}</> : null}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/app/recalls/${recall.id}`}
              className="inline-flex h-10 items-center gap-1.5 border border-line bg-white px-4 text-[12px] font-semibold hover:bg-bone"
            >
              View Recall <ArrowUpRight size={14} />
            </Link>
            <a
              href="#instructions"
              className="inline-flex h-10 items-center border border-line bg-white px-4 text-[12px] font-semibold hover:bg-bone"
            >
              Manufacturer Instructions
            </a>
          </div>
        </section>
      )}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.03fr)_minmax(360px,.97fr)] lg:gap-10">
        <div className="space-y-5">
          <ProductArt
            src={product.image}
            alt={`${product.name}, product photograph`}
            className="aspect-[1.12/1] min-h-[260px] border border-line bg-[#eeede8] sm:aspect-[1.28/1]"
          />
          <QrCard serial={product.serial} origin={origin} />
        </div>
        <div className="flex flex-col">
          <div className="border-b border-line pb-5">
            <p className="eyebrow">{product.maker}</p>
            <h1 className="mt-3 text-[36px] font-semibold leading-[1.02] tracking-[-.055em] sm:text-[43px]">{product.name}</h1>
            <p className="mt-2 text-[14px] text-muted">{product.category}</p>
            <div className="mt-5 grid grid-cols-2 gap-y-3 border-t border-line pt-4 text-[12px]">
              <div>
                <p className="eyebrow text-[9px]">Model</p>
                <p className="mono mt-1.5">{product.model}</p>
              </div>
              <div>
                <p className="eyebrow text-[9px]">Serial number</p>
                <p className="mono mt-1.5">{product.serial}</p>
              </div>
            </div>
          </div>
          <div className="grid gap-0 sm:grid-cols-2 sm:divide-x sm:divide-line">
            <div className="py-5 sm:pr-5">
              <p className="eyebrow">Current ownership</p>
              <p className="mt-2 text-[15px] font-semibold">{product.owner === "You" || recalled ? "Owned by you" : `Owned by ${product.owner}`}</p>
              <p className="mt-1 text-[12px] text-muted">{product.ownerSince ? `Since ${product.ownerSince}` : "Current owner of record."}</p>
            </div>
            <div className="border-t border-line py-5 sm:border-t-0 sm:pl-5">
              <p className="eyebrow">Product safety</p>
              <div className="mt-2">
                <SafetyStatus recalled={recalled} severity={severity} />
              </div>
              <p className="mt-1 text-[12px] leading-5 text-muted">
                {recalled ? "This unit is included in an active manufacturer recall." : "No active safety notices currently apply to this unit."}
              </p>
            </div>
          </div>
          <div className="mt-1 flex flex-wrap gap-2 border-t border-line pt-5">
            <Link
              href={`/app/products/${product.id}/transfer`}
              className="inline-flex h-10 items-center gap-2 bg-ink px-4 text-[12px] font-semibold text-white hover:bg-[#303234]"
            >
              <ArrowLeftRight size={14} /> Transfer Product
            </Link>
            {recall && (
              <Link
                href={`/app/recalls/${recall.id}`}
                className="inline-flex h-10 items-center gap-2 border border-line px-4 text-[12px] font-semibold hover:bg-bone"
              >
                View Recall <ArrowUpRight size={14} />
              </Link>
            )}
          </div>
          <div className="mt-auto border-t border-line pt-5">
            <ChainStatusBadge chain={product.chain} status={chainStatusOf(product)} unitId={product.id} compact />
          </div>
        </div>
      </div>
      <div className="mt-10 grid gap-8 border-t border-line pt-7 md:grid-cols-[1fr_1.1fr]">
        <div>
          <ProductTimeline
            entries={
              entries ??
              (recalled
                ? [
                    { title: "Registered", date: "Oct 1", detail: "Registered by Northstar Outdoor Tech." },
                    { title: "Issued", date: "Oct 2", detail: "First owner: Alice Morgan." },
                    { title: "Transferred", date: "Oct 8", detail: "Ownership transferred to Bob Chen." },
                    { title: "Recall issued", date: "Oct 9", detail: "Urgent battery recall applies." },
                  ]
                : [
                    { title: "Registered", date: "Aug 22", detail: "Registered by Northstar Outdoor Tech." },
                    { title: "Ownership received", date: "Aug 22", detail: "Product added to your collection." },
                  ])
            }
          />
        </div>
        <div id="instructions" className="border-l border-line pl-0 md:pl-8">
          <p className="eyebrow">Record integrity</p>
          <p className="mt-3 text-[15px] font-semibold">A product record that moves with it.</p>
          <p className="mt-2 max-w-md text-[12px] leading-5 text-muted">
            Ownership and safety updates are preserved with this unit’s passport, so important information can reach whoever owns it now.
          </p>
          <p className="mt-4 text-[11px] text-muted">
            {product.chain?.owner ? "Recorded on Solana" : "No on-chain record yet"}{" "}
            <span className="mx-2 text-line">/</span>
            <Link className="font-semibold text-ink underline underline-offset-4" href={`/verify/${product.serial}`}>
              View public record
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
