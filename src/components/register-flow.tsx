"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Copy, Loader2, QrCode } from "lucide-react";
import { ProductArt } from "@/components/product-art";
import { primaryProduct } from "@/lib/data";
import { getBrowserClient } from "@/lib/supabase/client";

export type RegisterModelOption = { id: string; name: string; sku: string; category?: string; image?: string };

const demoModels: RegisterModelOption[] = [
  { id: "HC10", name: "HeatCore 10K", sku: "HC10", category: "Portable battery pack", image: "/products/heatcore.svg" },
  { id: "TR4", name: "TrailRadio 4", sku: "TR4", category: "Outdoor electronics", image: "/products/trailradio.svg" },
  { id: "FC7", name: "FieldCharge 7", sku: "FC7", category: "Portable charger", image: "/products/fieldcharge.svg" },
];

export function RegisterFlow({ models, live = false }: { models?: RegisterModelOption[]; live?: boolean }) {
  const options = models?.length ? models : demoModels;
  const [step, setStep] = useState<"form" | "review" | "done">("form");
  const [modelId, setModelId] = useState(options[0].id);
  const [serial, setSerial] = useState("");
  const [owner, setOwner] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState(false);

  const selected = options.find((option) => option.id === modelId) ?? options[0];

  async function confirm() {
    if (!live) {
      setStep("done");
      return;
    }
    const supabase = getBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured in this environment.");
      return;
    }
    setWorking(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("register_product_unit", {
      p_model_id: modelId,
      p_serial_number: serial.trim(),
      p_initial_owner_wallet: owner.trim() || undefined,
    });
    setWorking(false);
    if (rpcError) {
      const lower = rpcError.message.toLowerCase();
      setError(
        lower.includes("serial already registered")
          ? "That serial number is already registered."
          : lower.includes("only manufacturer owners or admins")
            ? "You need manufacturer owner access to register units."
            : rpcError.message,
      );
      return;
    }
    setStep("done");
  }

  if (step === "done") return <div className="max-w-3xl border border-line bg-paper p-5 sm:p-7"><CheckCircle2 size={25} className="text-safe" /><p className="eyebrow mt-5">Product registered</p><h2 className="mt-2 text-[24px] font-semibold tracking-[-.04em]">A new passport is ready.</h2><p className="mt-2 text-[12px] text-muted">{live ? "Registered" : "Local preview created for"} {serial || "HC10-NEW"}.</p><div className="mt-6 grid gap-5 border-y border-line py-5 sm:grid-cols-[150px_1fr]"><div className="qr-grid !size-[132px] !grid-cols-9 !gap-[3px] border border-line bg-white p-2" aria-label="Mock product QR"><QrCode size={40} className="absolute m-auto text-ink" /></div><div><p className="eyebrow">Product passport preview</p><p className="mt-2 text-[17px] font-semibold">{selected.name}</p><p className="mono mt-1 text-[11px] text-muted">{serial || "HC10-NEW"}</p><p className="mt-3 text-[11px] text-muted">Initial owner: {owner || "Pending owner"}</p><Link href={live ? `/verify/${encodeURIComponent(serial)}` : `/verify/${primaryProduct.id}`} className="mt-4 inline-flex items-center gap-1 text-[11px] font-semibold underline underline-offset-4">Open public verification <ArrowRight size={13} /></Link><button onClick={() => setCopied(true)} className="ml-4 inline-flex items-center gap-1 text-[11px] font-semibold text-muted"><Copy size={12} />{copied ? "Copied preview link" : "Copy QR link"}</button></div></div><p className="mt-4 text-[10px] text-muted">{live ? "This registration is saved to RecallRelay and visible on the public verification page." : "This registration is a local visual preview and has not been saved to a backend."}</p></div>;

  return <div className="grid gap-7 lg:grid-cols-[1fr_280px]"><form onSubmit={(event) => { event.preventDefault(); setStep("review"); }} className="border border-line bg-paper p-5 sm:p-7"><p className="eyebrow">Unit registration</p><h2 className="mt-2 text-[20px] font-semibold tracking-[-.035em]">Product details</h2><div className="mt-6 grid gap-x-5 gap-y-4 sm:grid-cols-2"><label className="sm:col-span-2"><span className="text-[11px] font-semibold">Product model</span><select value={modelId} onChange={(event) => setModelId(event.target.value)} className="mt-2 h-10 w-full border border-line bg-paper px-3 text-[12px]">{options.map((option) => <option key={option.id} value={option.id}>{option.name} · {option.sku}</option>)}</select></label><label><span className="text-[11px] font-semibold">Serial number</span><input required value={serial} onChange={(event) => setSerial(event.target.value)} placeholder="e.g. HC10-2048" className="mono mt-2 h-10 w-full border border-line px-3 text-[11px] placeholder:text-[#9b9d99]" /></label><label><span className="text-[11px] font-semibold">Manufacture date <span className="font-normal text-muted">(optional)</span></span><input type="date" className="mt-2 h-10 w-full border border-line bg-paper px-3 text-[11px]" /></label><label><span className="text-[11px] font-semibold">Initial owner</span><input value={owner} onChange={(event) => setOwner(event.target.value)} placeholder={live ? "Recipient wallet address (optional)" : "Name or owner reference"} className="mt-2 h-10 w-full border border-line px-3 text-[11px] placeholder:text-[#9b9d99]" /></label><label><span className="text-[11px] font-semibold">Purchase date <span className="font-normal text-muted">(optional)</span></span><input type="date" className="mt-2 h-10 w-full border border-line bg-paper px-3 text-[11px]" /></label></div>{step === "review" ? <div className="mt-6 border border-line bg-[#f5f4f0] p-4"><p className="eyebrow">Review registration</p><div className="mt-3 space-y-2 border-b border-line pb-3 text-[11px]"><div className="flex justify-between"><span className="text-muted">Model</span><span className="font-semibold">{selected.name} · {selected.sku}</span></div><div className="flex justify-between"><span className="text-muted">Serial</span><span className="mono font-semibold">{serial}</span></div><div className="flex justify-between"><span className="text-muted">Initial owner</span><span className="font-semibold">{owner || "Pending owner"}</span></div></div>{error && <p role="alert" className="mt-3 text-[11px] text-urgent">{error}</p>}<div className="mt-4 flex gap-2"><button type="button" onClick={() => setStep("form")} className="h-10 border border-line px-4 text-[12px] font-semibold">Back</button><button type="button" onClick={confirm} disabled={working} className="inline-flex h-10 items-center gap-2 bg-ink px-4 text-[12px] font-semibold text-white disabled:opacity-60">{working && <Loader2 size={14} className="animate-spin" />}Confirm Registration <ArrowRight size={14} /></button></div><p className="mt-3 text-[10px] text-muted">{live ? "This will create a permanent product unit record." : "This is a local preview. Nothing is saved."}</p></div> : <button type="submit" className="mt-6 inline-flex h-10 items-center gap-2 bg-ink px-4 text-[12px] font-semibold text-white">Review Registration <ArrowRight size={14} /></button>}</form>
    <aside className="self-start border border-line bg-[#f0eee8] p-4"><ProductArt src={selected.image ?? primaryProduct.image} alt={`${selected.name} product image`} className="aspect-[1.4/1] border border-line bg-[#eeede8]" /><p className="eyebrow mt-4">Selected product model</p><h3 className="mt-1 text-[15px] font-semibold">{selected.name}</h3><p className="mt-1 text-[11px] text-muted">{selected.category ?? ""} · {selected.sku}</p><p className="mt-4 border-t border-line pt-3 text-[10px] leading-5 text-muted">Each serial identifies one physical product and its evolving ownership record.</p></aside></div>;
}
