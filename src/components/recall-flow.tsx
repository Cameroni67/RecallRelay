"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/client";

export type RecallModelOption = { id: string; name: string; sku: string };
export type RecallUnitOption = { id: string; serialNumber: string; ownerName: string | null; modelId?: string };

type ScopeKind = "all_units" | "selected_units" | "serial_range";

const demoModels: RecallModelOption[] = [
  { id: "HC10", name: "HeatCore 10K", sku: "HC10" },
  { id: "TR4", name: "TrailRadio 4", sku: "TR4" },
];

export function RecallFlow({
  models,
  units = [],
  manufacturerId,
  live = false,
}: {
  models?: RecallModelOption[];
  units?: RecallUnitOption[];
  manufacturerId?: string;
  live?: boolean;
}) {
  const options = models?.length ? models : demoModels;
  const [stage, setStage] = useState<"edit" | "review" | "done">("edit");
  const [title, setTitle] = useState("Battery overheating risk");
  const [action, setAction] = useState("Stop using immediately.");
  const [severity, setSeverity] = useState("urgent");
  const [modelId, setModelId] = useState(options[0].id);
  const [scope, setScope] = useState<ScopeKind>("all_units");
  const [serialFrom, setSerialFrom] = useState("");
  const [serialTo, setSerialTo] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [affected, setAffected] = useState(127);
  const [recallId, setRecallId] = useState("recall-hc10-2026");

  const selected = options.find((option) => option.id === modelId) ?? options[0];
  const scopedUnits = units.filter((unit) => !unit.modelId || unit.modelId === modelId);
  const scopeLabel =
    scope === "all_units"
      ? "All registered units"
      : scope === "serial_range"
        ? `Serial range ${serialFrom} – ${serialTo}`
        : `${selectedIds.length} selected serials`;

  async function publish() {
    if (!live) {
      setStage("done");
      return;
    }
    const supabase = getBrowserClient();
    if (!supabase || !manufacturerId) {
      setError("Supabase is not configured in this environment.");
      return;
    }
    setWorking(true);
    setError(null);

    let unitIds: string[] | undefined;
    if (scope === "selected_units") {
      if (!selectedIds.length) {
        setWorking(false);
        setError("Select at least one unit for this scope.");
        return;
      }
      const { data: unitRows, error: unitError } = await supabase
        .from("product_units")
        .select("id, serial_number")
        .eq("model_id", modelId)
        .in("serial_number", selectedIds);
      if (unitError) {
        setWorking(false);
        setError(unitError.message);
        return;
      }
      unitIds = (unitRows ?? []).map((row) => row.id);
      if (!unitIds.length) {
        setWorking(false);
        setError("No matching units found for those serials.");
        return;
      }
    }

    const { data, error: rpcError } = await supabase.rpc("issue_recall", {
      p_manufacturer_id: manufacturerId,
      p_model_id: modelId,
      p_title: title.trim(),
      p_required_action: action.trim(),
      p_severity: severity,
      p_scope_kind: scope,
      p_serial_from: scope === "serial_range" ? serialFrom.trim() : undefined,
      p_serial_to: scope === "serial_range" ? serialTo.trim() : undefined,
      p_unit_ids: unitIds,
    });
    setWorking(false);
    if (rpcError) {
      const lower = rpcError.message.toLowerCase();
      setError(
        lower.includes("only manufacturer owners or admins")
          ? "You need manufacturer owner access to issue recalls."
          : lower.includes("does not belong")
            ? "That model belongs to another manufacturer."
            : lower.includes("requires unit ids")
              ? "Select at least one unit for this scope."
              : rpcError.message,
      );
      return;
    }
    const payload = data as { id?: string; affected_units?: number } | null;
    setRecallId(payload?.id ?? "");
    setAffected(payload?.affected_units ?? 0);
    setStage("done");
  }

  if (stage === "done") return <div className="max-w-3xl border border-line bg-paper p-6 sm:p-8"><CheckCircle2 size={26} className="text-safe" /><p className="eyebrow mt-5">Recall published</p><h2 className="mt-2 text-[24px] font-semibold tracking-[-.04em]">Affected product owners have been identified.</h2><p className="mt-2 text-[12px] text-muted">{affected} product units in the {live ? "published" : "mock"} scope.{live ? "" : " No notifications were sent."}</p><div className="mt-6 flex flex-wrap gap-3"><Link href={`/manufacturer/recalls/${recallId}`} className="inline-flex h-10 items-center gap-2 bg-ink px-4 text-[11px] font-semibold text-white">View recall details <ArrowRight size={13} /></Link><Link href="/manufacturer/recalls" className="inline-flex h-10 items-center border border-line px-4 text-[11px] font-semibold">Recall management</Link></div></div>;

  const review = stage === "review";
  return <div className="grid gap-7 lg:grid-cols-[1fr_290px]"><section className="border border-line bg-paper p-5 sm:p-7"><div className="flex items-start gap-3"><AlertTriangle size={18} className="mt-0.5 text-urgent" /><div><p className="eyebrow">Manufacturer safety notice</p><h2 className="mt-1 text-[19px] font-semibold tracking-[-.03em]">Issue a recall</h2></div></div>{review ? <div className="mt-6 border border-[#e8c3bf] bg-[#fff8f6] p-5"><p className="text-[10px] font-bold tracking-[.12em] text-urgent">FINAL REVIEW · {severity === "urgent" ? "URGENT" : "NOTICE"}</p><h3 className="mt-3 text-[16px] font-semibold">{live ? "You’re about to issue a recall." : "You’re about to issue an urgent recall affecting 127 registered products."}</h3><dl className="mt-5 space-y-3 border-t border-[#e8c3bf] pt-4 text-[11px]"><div className="flex justify-between gap-4"><dt className="text-muted">Product</dt><dd className="font-semibold">{selected.name} · {selected.sku}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted">Severity</dt><dd className="font-semibold text-urgent">{severity === "urgent" ? "Urgent" : severity === "high" ? "High" : "Advisory"}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted">Scope</dt><dd className="text-right">{scopeLabel}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted">Reason</dt><dd className="text-right">{title}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted">Required action</dt><dd className="text-right">{action}</dd></div></dl>{error && <p role="alert" className="mt-4 text-[11px] text-urgent">{error}</p>}<div className="mt-4 flex gap-2"><button type="button" onClick={() => setStage("edit")} className="h-10 border border-line px-4 text-[12px] font-semibold">Back</button><button type="button" onClick={publish} disabled={working} className="inline-flex h-10 items-center gap-2 bg-ink px-4 text-[12px] font-semibold text-white disabled:opacity-60">{working && <Loader2 size={14} className="animate-spin" />}Publish Recall <ArrowRight size={14} /></button></div><p className="mt-3 text-[10px] leading-5 text-muted">{live ? "Publishing attaches the recall to affected units and notifies their current owners." : "This is a local preview. Publishing will not send notifications or modify product records."}</p></div> : <form onSubmit={(event) => { event.preventDefault(); setStage("review"); }} className="mt-6 space-y-5"><label className="block"><span className="text-[11px] font-semibold">Product model</span><select value={modelId} onChange={(event) => setModelId(event.target.value)} className="mt-2 h-10 w-full border border-line bg-paper px-3 text-[11px]">{options.map((option) => <option key={option.id} value={option.id}>{option.name} · {option.sku}</option>)}</select></label><label className="block"><span className="text-[11px] font-semibold">Recall title</span><input required value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} className="mt-2 h-10 w-full border border-line bg-paper px-3 text-[11px]" /></label><label className="block"><span className="text-[11px] font-semibold">Required action</span><input required value={action} onChange={(event) => setAction(event.target.value)} maxLength={300} className="mt-2 h-10 w-full border border-line bg-paper px-3 text-[11px]" /></label><label className="block"><span className="text-[11px] font-semibold">Severity</span><select value={severity} onChange={(event) => setSeverity(event.target.value)} className="mt-2 h-10 w-full border border-line bg-paper px-3 text-[11px]"><option value="urgent">Urgent</option><option value="high">High</option><option value="advisory">Advisory</option></select></label><fieldset><legend className="text-[11px] font-semibold">Affected units</legend><div className="mt-2 space-y-2">{([{ label: "All registered units", kind: "all_units" }, { label: "Specific serials", kind: "selected_units" }, { label: "Serial range", kind: "serial_range" }] as { label: string; kind: ScopeKind }[]).map(({ label, kind }) => <label key={kind} className="flex items-center gap-2 border border-line px-3 py-2.5 text-[11px]"><input type="radio" name="scope" checked={scope === kind} onChange={() => setScope(kind)} />{label}</label>)}</div>{scope === "serial_range" && <div className="mt-3 grid grid-cols-2 gap-3"><input required value={serialFrom} onChange={(event) => setSerialFrom(event.target.value)} placeholder="From e.g. HC10-2000" className="mono h-10 border border-line px-3 text-[11px]" /><input required value={serialTo} onChange={(event) => setSerialTo(event.target.value)} placeholder="To e.g. HC10-2100" className="mono h-10 border border-line px-3 text-[11px]" /></div>}{scope === "selected_units" && <div className="mt-3 max-h-44 overflow-auto border border-line">{scopedUnits.length ? scopedUnits.map((unit) => <label key={unit.id} className="flex items-center gap-2 border-b border-line px-3 py-2 text-[11px] last:border-0"><input type="checkbox" checked={selectedIds.includes(unit.serialNumber)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, unit.serialNumber] : current.filter((serial) => serial !== unit.serialNumber))} /><span className="mono">{unit.serialNumber}</span><span className="ml-auto text-muted">{unit.ownerName ?? "Unassigned"}</span></label>) : <p className="px-3 py-3 text-[11px] text-muted">No units registered for this model.</p>}</div>}</fieldset><button type="submit" className="inline-flex h-10 items-center gap-2 bg-ink px-4 text-[12px] font-semibold text-white">Review Recall <ArrowRight size={14} /></button></form>}</section>
    <aside className="self-start border border-line bg-[#f0eee8] p-4"><p className="eyebrow">Recall impact</p><h3 className="mt-2 text-[16px] font-semibold">{scopeLabel}</h3><p className="mt-3 border-t border-line pt-3 text-[11px] leading-5 text-muted">Affected units match by model, serial range, or selected serials. Current owners are identified automatically and notified.</p></aside></div>;
}
