import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/page-heading";
import { RegisterFlow } from "@/components/register-flow";

export default function RegisterUnitPage() { return <AppShell manufacturer><PageHeading eyebrow="Northstar Outdoor Tech · Unit registry" title="Register Product Unit" description="Create a product passport for a single physical unit." /><RegisterFlow /></AppShell>; }
