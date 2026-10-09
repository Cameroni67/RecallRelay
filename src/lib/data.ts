export type Product = {
  id: string;
  maker: string;
  name: string;
  category: string;
  model: string;
  serial: string;
  image: string;
  owner: string;
  ownerSince: string;
  safety: "clear" | "recalled" | "transferred";
  lastAction: string;
};

export const products: Product[] = [
  { id: "HC10-2048", maker: "Northstar Outdoor Tech", name: "HeatCore 10K", category: "Portable battery pack", model: "HC10", serial: "HC10-2048", image: "/products/heatcore.svg", owner: "Bob Chen", ownerSince: "October 8, 2026", safety: "recalled", lastAction: "Urgent recall · Oct 9, 2026" },
  { id: "TR4-0831", maker: "Northstar Outdoor Tech", name: "TrailRadio 4", category: "Outdoor electronics", model: "TR4", serial: "TR4-0831", image: "/products/trailradio.svg", owner: "You", ownerSince: "September 14, 2026", safety: "clear", lastAction: "No active recalls" },
  { id: "VC2-1190", maker: "Vale Cycle Works", name: "VoltCell 2", category: "E-bike battery", model: "VC2", serial: "VC2-1190", image: "/products/voltcell.svg", owner: "Alice Morgan", ownerSince: "May 02, 2026", safety: "transferred", lastAction: "Transferred · Oct 7, 2026" },
  { id: "CH7-5512", maker: "Northstar Outdoor Tech", name: "FieldCharge 7", category: "Portable charger", model: "FC7", serial: "FC7-5512", image: "/products/fieldcharge.svg", owner: "You", ownerSince: "August 22, 2026", safety: "clear", lastAction: "No active recalls" },
];

export const primaryProduct = products[0];
export const ownedProducts = products.filter((product) => product.owner === "You" || product.owner === "Bob Chen");

export function findProduct(id: string): Product | undefined {
  return products.find((product) => product.id.toLowerCase() === decodeURIComponent(id).toLowerCase());
}

export const timeline = [
  { title: "Registered", date: "Oct 1", detail: "Registered by Northstar Outdoor Tech." },
  { title: "Issued", date: "Oct 2", detail: "First owner: Alice Morgan." },
  { title: "Transferred", date: "Oct 8", detail: "Ownership transferred to Bob Chen." },
  { title: "Recall issued", date: "Oct 9", detail: "Urgent battery recall applies." },
];

export const ownerNav = [
  { label: "My Products", href: "/app/products", icon: "package" },
  { label: "Transfers", href: "/app/transfers", icon: "transfer" },
  { label: "Recalls", href: "/app/recalls", icon: "alert" },
  { label: "Profile", href: "/app/profile", icon: "user" },
] as const;

export const manufacturerNav = [
  { label: "Products", href: "/manufacturer/products", icon: "package" },
  { label: "Units", href: "/manufacturer/units/HC10-2048", icon: "unit" },
  { label: "Recalls", href: "/manufacturer/recalls", icon: "alert" },
  { label: "Profile", href: "/manufacturer/profile", icon: "user" },
] as const;
