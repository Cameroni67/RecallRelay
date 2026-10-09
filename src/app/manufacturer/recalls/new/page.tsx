import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/page-heading";
import { RecallFlow } from "@/components/recall-flow";

export default function NewRecallPage() { return <AppShell manufacturer><PageHeading eyebrow="Northstar Outdoor Tech · Product safety" title="Issue Recall" description="Define the affected units, safety issue, and required action." /><RecallFlow /></AppShell>; }
