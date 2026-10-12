"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { qrSvg } from "@/lib/qr";
import { verifyPath } from "@/lib/site";

/**
 * Real, scannable QR code for a product's public verification page.
 *
 * The payload is always `<site origin>/verify/<serial>` — public data only.
 * The origin comes from `NEXT_PUBLIC_SITE_URL` (server-passed) and falls back
 * to the browser's own origin, so the QR works on production, local and
 * preview hosts without any hardcoded URLs.
 */
export function QrCard({
  serial,
  origin = null,
}: {
  serial: string;
  origin?: string | null;
}) {
  const path = verifyPath(serial);
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const target = `${origin ?? window.location.origin}${path}`;
    qrSvg(target)
      .then((value) => {
        if (!cancelled) setSvg(value);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [origin, path]);

  function download() {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `recallrelay-verify-${serial}.svg`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="border border-line bg-[#f7f6f2] p-4">
      <p className="eyebrow">Verify this product</p>
      <div
        aria-busy={svg || failed ? undefined : "true"}
        className="mt-3 grid place-items-center border border-line bg-white p-3"
      >
        {svg ? (
          <div
            role="img"
            aria-label={`QR code linking to the public verification page for ${serial}`}
            className="[&_svg]:block [&_svg]:h-auto [&_svg]:w-full [&_svg]:max-w-[180px]"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : failed ? (
          <p className="max-w-[190px] px-2 py-6 text-center text-[11px] leading-5 text-muted">
            QR unavailable right now — open the verification link below instead.
          </p>
        ) : (
          <div className="h-[180px] w-[180px] animate-pulse bg-[#eeede8]" aria-hidden />
        )}
      </div>
      <p className="mt-3 text-[12px] font-semibold">{serial}</p>
      <p className="text-[10px] leading-4 text-muted">Scan to open this product’s public verification page.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={path}
          className="inline-flex h-9 items-center border border-line bg-paper px-3 text-[11px] font-semibold hover:border-ink"
        >
          Open verification
        </a>
        <button
          type="button"
          onClick={download}
          disabled={!svg}
          className="inline-flex h-9 items-center gap-1.5 border border-line bg-paper px-3 text-[11px] font-semibold hover:border-ink disabled:opacity-50"
        >
          <Download size={13} />
          Download QR
        </button>
      </div>
      <p className="mt-2 break-all text-[10px] text-muted">{path}</p>
    </div>
  );
}
