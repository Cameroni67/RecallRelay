import { requireManufacturer } from "@/lib/auth/session";

export default async function ManufacturerWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireManufacturer();
  return <>{children}</>;
}
