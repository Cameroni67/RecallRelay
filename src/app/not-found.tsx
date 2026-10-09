import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";
import { PublicHeader } from "@/components/public-header";

export default function NotFound() {
  return <main className="min-h-screen bg-paper"><PublicHeader /><section className="mx-auto flex min-h-[65vh] max-w-[720px] flex-col items-start justify-center px-5 py-16 sm:px-8"><SearchX size={23} strokeWidth={1.5} className="text-muted" /><p className="eyebrow mt-6">Product record unavailable</p><h1 className="mt-3 text-[35px] font-semibold tracking-[-.06em]">We couldn’t find that record.</h1><p className="mt-3 max-w-md text-[13px] leading-6 text-muted">Check the product reference and try again. A record may also be unavailable if the link is incomplete.</p><Link href="/" className="mt-7 inline-flex items-center gap-2 border border-ink px-4 py-2.5 text-[11px] font-semibold"><ArrowLeft size={13} /> Return to RecallRelay</Link></section></main>;
}
