import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RecallRelay — Recalls that follow the product",
  description: "A portable product passport for ownership and safety, wherever a product goes.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
