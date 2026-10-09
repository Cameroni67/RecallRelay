import { requireOwner } from "@/lib/auth/session";

export default async function OwnerWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireOwner();
  return <>{children}</>;
}
