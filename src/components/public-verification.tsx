import type { Product } from "@/lib/data";
import { SafetyStatus, VerificationBadge } from "@/components/badges";
import { severityConfig, SeverityMark } from "@/components/severity";
import { ChainStatusBadge, chainStatusOf } from "@/components/chain-status";
import { ProductArt } from "@/components/product-art";
import { formatDateLong, formatDateShort } from "@/lib/db/mappers";
import { PROGRAM_ID, explorerAccountLink, explorerTxLink } from "@/lib/solana/deployment";

/**
 * Public verification page composition for /verify/[serial].
 *
 * Mobile order follows the spec: identity → safety → authenticity →
 * ownership → required action → history → Solana. It shows real recall data,
 * chain-backed ownership and transfer count, and NEVER exposes owner names,
 * emails, auth ids, full wallets or membership internals. Solana details are
 * present but secondary.
 */

const HISTORY_LABEL: Record<string, string> = {
  registered: "Product registered",
  transferred: "Ownership transferred",
  recall_issued: "Recall issued",
};

function Section({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section aria-label={label} className={`border border-line bg-paper px-5 py-5 ${className}`}>
      {children}
    </section>
  );
}

export function PublicVerification({ product }: { product: Product }) {
  const recall = product.recall ?? null;
  const severity = recall?.severity ?? "urgent";
  const { banner, panel } = severityConfig(severity);
  const transferCount = product.chain?.transferCount ?? null;

  return (
    <div className="page-in grid gap-5 lg:grid-cols-2">
      {/* 1. identity */}
      <Section label="Product identity" className="lg:col-span-2">
        <div className="grid gap-5 sm:grid-cols-[220px_1fr]">
          <ProductArt
            src={product.image}
            alt={`${product.name}, product photograph`}
            className="aspect-square border border-line bg-[#eeede8]"
          />
          <div>
            <p className="eyebrow">{product.maker}</p>
            <h2 className="mt-2 text-[26px] font-semibold leading-tight tracking-[-.045em]">{product.name}</h2>
            <p className="mt-1 text-[13px] text-muted">{product.category}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
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
        </div>
      </Section>

      {/* 2. safety status */}
      <Section label="Safety status">
        <p className="eyebrow">Safety status</p>
        {recall ? (
          <div role="alert" className={`mt-3 border px-4 py-3 ${panel}`}>
            <SeverityMark severity={severity} />
            <p className={`mt-1 text-[15px] font-bold tracking-[-.02em] ${severityConfig(severity).tone}`}>{banner}</p>
            <p className="mt-1 text-[13px] font-semibold">{recall.title}</p>
            <p className="mt-1 text-[11px] text-muted">
              Issued by {product.maker}
              {recall.issuedAt ? <> · {formatDateShort(recall.issuedAt)}</> : null}
            </p>
          </div>
        ) : (
          <div className="mt-3">
            <SafetyStatus recalled={false} />
            <p className="mt-1 text-[12px] text-muted">No active safety notices apply to this unit.</p>
          </div>
        )}
      </Section>

      {/* 3. authenticity */}
      <Section label="Authenticity">
        <p className="eyebrow">Authenticity</p>
        <div className="mt-3">
          <VerificationBadge />
        </div>
        <ul className="mt-3 space-y-1.5 text-[12px] text-muted">
          {product.makerVerified && (
            <li className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-safe" aria-hidden />
              Verified manufacturer · {product.maker}
            </li>
          )}
          <li className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-safe" aria-hidden />
            Registered on RecallRelay
            {product.registeredAt ? <> · {formatDateLong(product.registeredAt)}</> : null}
          </li>
        </ul>
      </Section>

      {/* 4. ownership */}
      <Section label="Ownership">
        <p className="eyebrow">Ownership</p>
        <p className="mt-3 text-[15px] font-semibold">Current ownership recorded</p>
        <p className="mt-1 text-[12px] leading-5 text-muted">
          {transferCount !== null
            ? `Ownership has been transferred ${transferCount} ${transferCount === 1 ? "time" : "times"} on record. Owner details stay private.`
            : "Owner details stay private — this page verifies the record, not the person."}
        </p>
        <div className="mt-3">
          <ChainStatusBadge
            chain={product.chain}
            status={chainStatusOf(product)}
            unitId={product.id}
            publicMode
          />
        </div>
      </Section>

      {/* 5. required action (only when a recall applies) */}
      {recall && (
        <Section label="Required action" className="lg:col-span-2">
          <p className="eyebrow">Required action</p>
          <p className="mt-3 max-w-2xl text-[16px] font-semibold leading-6">{recall.requiredAction}</p>
          <p className="mt-2 text-[12px] text-muted">
            Follow the manufacturer’s instructions above. Recall details on this page are published by {product.maker} and
            update as the recall progresses.
          </p>
        </Section>
      )}

      {/* 6. history */}
      {product.history && product.history.length > 0 && (
        <Section label="Product history">
          <p className="eyebrow">Product history</p>
          <ol className="mt-3 space-y-2.5">
            {product.history.map((entry, index) => (
              <li key={`${entry.kind}-${index}`} className="flex items-baseline justify-between gap-3 border-b border-line pb-2 text-[12px] last:border-b-0">
                <span className="font-medium">{HISTORY_LABEL[entry.kind] ?? "Product record updated"}</span>
                <span className="text-muted">{formatDateShort(entry.at)}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {/* 7. Solana record (secondary) */}
      <Section label="Solana record" className="lg:col-span-2">
        <p className="eyebrow">Solana record</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted">
          <span>Cluster · Solana Devnet</span>
          <span className="mono break-all">Program · {PROGRAM_ID}</span>
          {product.chain?.pda && (
            <a
              className="inline-flex items-center gap-1 font-semibold text-ink underline underline-offset-4"
              href={explorerAccountLink(product.chain.pda)}
              target="_blank"
              rel="noreferrer"
            >
              View account in explorer
            </a>
          )}
          {product.chain?.txSignature && (
            <a
              className="inline-flex items-center gap-1 font-semibold text-ink underline underline-offset-4"
              href={explorerTxLink(product.chain.txSignature)}
              target="_blank"
              rel="noreferrer"
            >
              View registration transaction
            </a>
          )}
        </div>
        <p className="mt-2 text-[10px] leading-4 text-muted">
          Registrations and ownership live on Solana; recall notices, safety text and history are published by the
          manufacturer through RecallRelay. This page never shows owner names, emails or wallet addresses.
        </p>
      </Section>
    </div>
  );
}
