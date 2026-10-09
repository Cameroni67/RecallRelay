import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/page-heading";
import { RegisterFlow } from "@/components/register-flow";
import { requireManufacturer } from "@/lib/auth/session";
import { listModelOptions } from "@/lib/db/manufacturer";

export default async function RegisterUnitPage() {
  const ctx = await requireManufacturer();
  const models = await listModelOptions(ctx.manufacturer.id);
  return <AppShell manufacturer workspaceName={ctx.workspaceName}><PageHeading eyebrow={`${ctx.manufacturer.name} · Unit registry`} title="Register Product Unit" description="Create a product passport for a single physical unit." /><RegisterFlow models={models} live={!ctx.demo} /></AppShell>;
}
