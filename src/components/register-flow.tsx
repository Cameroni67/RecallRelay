"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Copy, Link2Off, Loader2, QrCode, RefreshCw, ShieldCheck } from "lucide-react";
import { ProductArt } from "@/components/product-art";
import { primaryProduct } from "@/lib/data";
import { getBrowserClient } from "@/lib/supabase/client";
import { connectWallet, signPreparedTransaction } from "@/lib/solana/wallet";

export type RegisterModelOption = { id: string; name: string; sku: string; category?: string; image?: string };

const demoModels: RegisterModelOption[] = [
  { id: "HC10", name: "HeatCore 10K", sku: "HC10", category: "Portable battery pack", image: "/products/heatcore.svg" },
  { id: "TR4", name: "TrailRadio 4", sku: "TR4", category: "Outdoor electronics", image: "/products/trailradio.svg" },
  { id: "FC7", name: "FieldCharge 7", sku: "FC7", category: "Portable charger", image: "/products/fieldcharge.svg" },
];

export function RegisterFlow({
  models,
  live = false,
  sessionWallet = null,
}: {
  models?: RegisterModelOption[];
  live?: boolean;
  /** The signed-in user's SIWS wallet — the transaction wallet must match it. */
  sessionWallet?: string | null;
}) {
  const options = models?.length ? models : demoModels;
  const [step, setStep] = useState<"form" | "review" | "done">("form");
  const [modelId, setModelId] = useState(options[0].id);
  const [serial, setSerial] = useState("");
  const [owner, setOwner] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [chainTx, setChainTx] = useState<string | null>(null);
  const [chainSynced, setChainSynced] = useState(false);
  const [chainNote, setChainNote] = useState<string | null>(null);

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
    const { data: rpcData, error: rpcError } = await supabase.rpc("register_product_unit", {
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
    const created = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    const newUnitId = created && typeof created === "object" && "id" in created ? String(created.id) : null;
    setUnitId(newUnitId);
    setStep("done");

    // Phase 3: put the unit on chain. The database row exists either way, so
    // a chain failure never loses the registration — it just leaves the
    // passport honest about having no on-chain record yet.
    if (newUnitId) {
      await registerOnChain(newUnitId);
    }
  }

  /**
   * Prepare, sign and send the on-chain registration, then reconcile. If the
   * transaction lands but reconciliation fails, we say so plainly and offer
   * "Retry verification" rather than re-registering — the unit already has an
   * on-chain account and re-registering would be rejected as a duplicate.
   */
  async function registerOnChain(id: string) {
    try {
      setChainNote("Preparing on-chain registration…");
      const connected = await connectWallet();
      if (sessionWallet && connected.toLowerCase() !== sessionWallet.toLowerCase()) {
        setChainNote(null);
        setError("Wallet mismatch — the connected wallet is not the signed-in wallet.");
        return;
      }
      const prepared = await fetch("/api/chain/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register-product", unitId: id, ownerWallet: owner.trim() }),
      });
      const prep = await prepared.json();
      if (!prepared.ok) {
        setChainNote(null);
        setError(prep.error ?? "Could not prepare the on-chain registration.");
        return;
      }
      setChainNote("Confirm in your wallet…");
      const signed = await signPreparedTransaction(prep.transaction);
      const sent = await fetch("/api/chain/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaction: signed }),
      });
      const sendResult = await sent.json();
      if (!sendResult.ok) {
        setChainNote(null);
        setError(sendResult.error ?? "The registration transaction failed on chain.");
        return;
      }
      setChainTx(sendResult.signature);
      setChainNote("Transaction confirmed. Syncing product record…");
      const reconciled = await fetch(`/api/products/${id}/reconcile-chain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txSignature: sendResult.signature }),
      });
      if (reconciled.ok) {
        setChainSynced(true);
        setChainNote(null);
      } else {
        const body = await reconciled.json();
        setChainNote(body.error ?? "Transaction confirmed. Syncing product record.");
      }
    } catch (err) {
      setChainNote(null);
      setError(err instanceof Error ? err.message : "The wallet could not sign the registration.");
    }
  }

  async function retryVerification() {
    if (!unitId) return;
    setChainNote("Re-checking the chain…");
    const reconciled = await fetch(`/api/products/${unitId}/reconcile-chain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (reconciled.ok) {
      setChainSynced(true);
      setChainNote(null);
      setError(null);
    } else {
      const body = await reconciled.json();
      setChainNote(body.error ?? "Still unable to confirm on chain.");
    }
  }

  if (step === "done") return <div className="max-w-3xl border border-line bg-paper p-5 sm:p-7"><CheckCircle2 size={25} className="text-safe" /><p className="eyebrow mt-5">Product registered</p><h2 className="mt-2 text-[24px] font-semibold tracking-[-.04em]">A new passport is ready.</h2><p className="mt-2 text-[12px] text-muted">{live ? "Registered" : "Local preview created for"} {serial || "HC10-NEW"}.</p>{live && <div className="mt-5" data-chain-status={chainSynced ? "synced" : chainTx ? "pending" : unitId ? "unregistered" : "unregistered"}>{chainSynced ? <div className="flex items-start gap-2 border border-line bg-[#f7f6f2] px-4 py-3"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-safe" /><div><p className="text-[13px] font-semibold">Verified on Solana</p><p className="mt-1 text-[12px] leading-5 text-muted">Registration confirmed on chain and synced to the product record.</p>{chainTx && <a className="mt-1 inline-flex items-center gap-1 text-[11px] underline underline-offset-4" href={`https://explorer.solana.com/tx/${chainTx}?cluster=devnet`} target="_blank" rel="noreferrer">View transaction</a>}</div></div> : chainTx ? <div className="flex items-start gap-2 border border-line bg-[#f7f6f2] px-4 py-3"><Loader2 size={16} className="mt-0.5 shrink-0 animate-spin text-muted" /><div><p className="text-[13px] font-semibold">Transaction confirmed. Syncing product record.</p><p className="mt-1 text-[12px] leading-5 text-muted">The unit exists on chain. The database record is catching up.</p><a className="mt-1 inline-flex items-center gap-1 text-[11px] underline underline-offset-4" href={`https://explorer.solana.com/tx/${chainTx}?cluster=devnet`} target="_blank" rel="noreferrer">View transaction</a></div></div> : <div className="flex items-start gap-2 border border-line bg-[#f7f6f2] px-4 py-3"><Link2Off size={16} className="mt-0.5 shrink-0 text-muted" /><div><p className="text-[13px] font-semibold">No on-chain record yet</p><p className="mt-1 text-[12px] leading-5 text-muted">This passport is saved but is not registered on Solana.</p><button onClick={registerOnChain.bind(null, unitId!)} className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold underline underline-offset-4"><RefreshCw size={12} />Register on chain</button></div></div>}{chainNote && !chainSynced && <p className="mt-2 text-[11px] text-muted">{chainNote}</p>}{chainTx && !chainSynced && <button onClick={retryVerification} className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold underline underline-offset-4"><RefreshCw size={12} />Retry verification</button>}</div>}<div className="mt-6 grid gap-5 border-y border-line py-5 sm:grid-cols-[150px_1fr]"><div className="qr-grid !size-[132px] !grid-cols-9 !gap-[3px] border border-line bg-white p-2" aria-label="Mock product QR"><QrCode size={40} className="absolute m-auto text-ink" /></div><div><p className="eyebrow">Product passport preview</p><p className="mt-2 text-[17px] font-semibold">{selected.name}</p><p className="mono mt-1 text-[11px] text-muted">{serial || "HC10-NEW"}</p><p className="mt-3 text-[11px] text-muted">Initial owner: {owner || "Pending owner"}</p><Link href={live ? `/verify/${encodeURIComponent(serial)}` : `/verify/${primaryProduct.id}`} className="mt-4 inline-flex items-center gap-1 text-[11px] font-semibold underline underline-offset-4">Open public verification <ArrowRight size={13} /></Link><button onClick={() => setCopied(true)} className="ml-4 inline-flex items-center gap-1 text-[11px] font-semibold text-muted"><Copy size={12} />{copied ? "Copied preview link" : "Copy QR link"}</button></div></div><p className="mt-4 text-[10px] text-muted">{live ? "This registration is saved to RecallRelay and visible on the public verification page." : "This registration is a local visual preview and has not been saved to a backend."}</p></div>;

  return <div className="grid gap-7 lg:grid-cols-[1fr_280px]"><form onSubmit={(event) => { event.preventDefault(); setStep("review"); }} className="border border-line bg-paper p-5 sm:p-7"><p className="eyebrow">Unit registration</p><h2 className="mt-2 text-[20px] font-semibold tracking-[-.035em]">Product details</h2><div className="mt-6 grid gap-x-5 gap-y-4 sm:grid-cols-2"><label className="sm:col-span-2"><span className="text-[11px] font-semibold">Product model</span><select value={modelId} onChange={(event) => setModelId(event.target.value)} className="mt-2 h-10 w-full border border-line bg-paper px-3 text-[12px]">{options.map((option) => <option key={option.id} value={option.id}>{option.name} · {option.sku}</option>)}</select></label><label><span className="text-[11px] font-semibold">Serial number</span><input required value={serial} onChange={(event) => setSerial(event.target.value)} placeholder="e.g. HC10-2048" className="mono mt-2 h-10 w-full border border-line px-3 text-[11px] placeholder:text-[#9b9d99]" /></label><label><span className="text-[11px] font-semibold">Manufacture date <span className="font-normal text-muted">(optional)</span></span><input type="date" className="mt-2 h-10 w-full border border-line bg-paper px-3 text-[11px]" /></label><label><span className="text-[11px] font-semibold">Initial owner</span><input value={owner} onChange={(event) => setOwner(event.target.value)} placeholder={live ? "Recipient wallet address (optional)" : "Name or owner reference"} className="mt-2 h-10 w-full border border-line px-3 text-[11px] placeholder:text-[#9b9d99]" /></label><label><span className="text-[11px] font-semibold">Purchase date <span className="font-normal text-muted">(optional)</span></span><input type="date" className="mt-2 h-10 w-full border border-line bg-paper px-3 text-[11px]" /></label></div>{step === "review" ? <div className="mt-6 border border-line bg-[#f5f4f0] p-4"><p className="eyebrow">Review registration</p><div className="mt-3 space-y-2 border-b border-line pb-3 text-[11px]"><div className="flex justify-between"><span className="text-muted">Model</span><span className="font-semibold">{selected.name} · {selected.sku}</span></div><div className="flex justify-between"><span className="text-muted">Serial</span><span className="mono font-semibold">{serial}</span></div><div className="flex justify-between"><span className="text-muted">Initial owner</span><span className="font-semibold">{owner || "Pending owner"}</span></div></div>{error && <p role="alert" className="mt-3 text-[11px] text-urgent">{error}</p>}<div className="mt-4 flex gap-2"><button type="button" onClick={() => setStep("form")} className="h-10 border border-line px-4 text-[12px] font-semibold">Back</button><button type="button" onClick={confirm} disabled={working} className="inline-flex h-10 items-center gap-2 bg-ink px-4 text-[12px] font-semibold text-white disabled:opacity-60">{working && <Loader2 size={14} className="animate-spin" />}Confirm Registration <ArrowRight size={14} /></button></div><p className="mt-3 text-[10px] text-muted">{live ? "This will create a permanent product unit record." : "This is a local preview. Nothing is saved."}</p></div> : <button type="submit" className="mt-6 inline-flex h-10 items-center gap-2 bg-ink px-4 text-[12px] font-semibold text-white">Review Registration <ArrowRight size={14} /></button>}</form>
    <aside className="self-start border border-line bg-[#f0eee8] p-4"><ProductArt src={selected.image ?? primaryProduct.image} alt={`${selected.name} product image`} className="aspect-[1.4/1] border border-line bg-[#eeede8]" /><p className="eyebrow mt-4">Selected product model</p><h3 className="mt-1 text-[15px] font-semibold">{selected.name}</h3><p className="mt-1 text-[11px] text-muted">{selected.category ?? ""} · {selected.sku}</p><p className="mt-4 border-t border-line pt-3 text-[10px] leading-5 text-muted">Each serial identifies one physical product and its evolving ownership record.</p></aside></div>;
}
