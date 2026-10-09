import { PublicHeader } from "@/components/public-header";

export default function VerificationLoading() {
  return <main className="min-h-screen bg-paper"><PublicHeader /><div className="mx-auto max-w-[1200px] animate-pulse px-5 py-9 sm:px-8"><div className="h-2 w-40 bg-[#e9e8e3]" /><div className="mt-3 h-8 w-56 bg-[#eeede8]" /><div className="mt-8 grid gap-8 lg:grid-cols-2"><div className="aspect-[1.2/1] bg-[#eeede8]" /><div><div className="h-2 w-44 bg-[#e9e8e3]" /><div className="mt-5 h-10 w-64 bg-[#eeede8]" /><div className="mt-8 h-20 border-y border-line" /></div></div></div></main>;
}
