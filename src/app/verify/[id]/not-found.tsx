import Link from "next/link";
import { SearchX } from "lucide-react";
import { PublicHeader } from "@/components/public-header";

export default function VerifyNotFound() {
  return (
    <main className="min-h-screen bg-paper">
      <PublicHeader />
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-start justify-center px-5 py-10 sm:px-8">
        <SearchX size={22} className="text-muted" />
        <p className="eyebrow mt-5">No public record</p>
        <h1 className="mt-2 text-[27px] font-semibold tracking-[-.05em]">
          No product matches this code.
        </h1>
        <p className="mt-2 text-[12px] leading-5 text-muted">
          Check the serial number or scan the QR code again. If the product has not been registered on RecallRelay
          yet, there is nothing to verify.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center border border-line px-4 text-[11px] font-semibold"
        >
          Return home
        </Link>
      </div>
    </main>
  );
}
