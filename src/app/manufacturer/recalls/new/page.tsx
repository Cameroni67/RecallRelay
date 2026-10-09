import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/page-heading";
import { RecallFlow } from "@/components/recall-flow";
import { requireManufacturer } from "@/lib/auth/session";
import { listModelOptions, listAllUnits } from "@/lib/db/manufacturer";

export default async function NewRecallPage() {
  const ctx = await requireManufacturer();
  const [models, units] = await Promise.all([
    listModelOptions(ctx.manufacturer.id),
    listAllUnits(),
  ]);
  return <AppShell manufacturer workspaceName={ctx.workspaceName}><PageHeading eyebrow={`${ctx.manufacturer.name} · Product safety`} title="Issue Recall" description="Define the affected units, safety issue, and required action." /><RecallFlow models={models} units={units} manufacturerId={ctx.manufacturer.id} live={!ctx.demo} /></AppShell>;
}
