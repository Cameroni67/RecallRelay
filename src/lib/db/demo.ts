import { findProduct, ownedProducts, products, timeline } from "@/lib/data";
import type { RecallScopeRow } from "@/lib/db/mappers";

/** Phase 1 fixtures used whenever Supabase is not configured (demo mode). */
export const demoProducts = products;
export const demoOwnedProducts = ownedProducts;
export const demoFindProduct = findProduct;
export const demoTimeline = timeline;

export type DemoModel = {
  id: string;
  name: string;
  category: string;
  units: number;
  safety: string;
  image: string;
};

export const demoModels: DemoModel[] = [
  { id: "HC10", name: "HeatCore 10K", category: "Portable battery pack", units: 184, safety: "1 active recall", image: "/products/heatcore.svg" },
  { id: "TR4", name: "TrailRadio 4", category: "Outdoor electronics", units: 51, safety: "No active recalls", image: "/products/trailradio.svg" },
  { id: "FC7", name: "FieldCharge 7", category: "Portable charger", units: 51, safety: "No active recalls", image: "/products/fieldcharge.svg" },
];

export const demoRecall: RecallScopeRow = {
  id: "recall-hc10-2026",
  manufacturer_id: "44444444-4444-4444-4444-444444444444",
  model_id: "HC10",
  title: "Battery overheating risk",
  severity: "urgent",
  required_action: "Stop using immediately.",
  scope_kind: "all_units",
  serial_from: null,
  serial_to: null,
  issued_at: "2026-10-09T08:00:00.000Z",
  status: "active",
  recall_units: [],
};

export const demoStats = {
  registeredUnits: 286,
  activeRecalls: 1,
  ownersReached: 127,
  modelCount: 3,
};
