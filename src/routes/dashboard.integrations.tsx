import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { integrationsApi } from "@/services/apiClient";
import type { ExternalSystem, IntegrationEvent } from "@/types/api";

export const Route = createFileRoute("/dashboard/integrations")({ component: IntegrationsPage });

function IntegrationsPage() {
  return (
    <>
      <PageHeader title="Integrations" description="External systems, mappings and events." />
      <Tabs defaultValue="systems">
        <TabsList className="mb-4">
          <TabsTrigger value="systems">Systems</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
        </TabsList>
        <TabsContent value="systems"><SystemsTab /></TabsContent>
        <TabsContent value="events"><EventsTab /></TabsContent>
      </Tabs>
    </>
  );
}

function SystemsTab() {
  const { data, isLoading } = useQuery({ queryKey: ["integration-systems"], queryFn: integrationsApi.listSystems });
  const cols: Column<ExternalSystem>[] = [
    { key: "code", header: "Code", cell: (r) => <code className="text-xs">{r.code}</code> },
    { key: "name", header: "Name", cell: (r) => <span className="font-semibold">{r.name}</span> },
    { key: "type", header: "Type", cell: (r) => <StatusBadge tone="info">{r.systemType}</StatusBadge> },
    { key: "url", header: "Base URL", cell: (r) => r.baseUrl ?? "—" },
    { key: "active", header: "Status", cell: (r) => <StatusBadge tone={r.isActive ? "success" : "muted"}>{r.isActive ? "Active" : "Inactive"}</StatusBadge> },
  ];
  return <DataTable columns={cols} rows={data} loading={isLoading} emptyTitle="No integrations connected" />;
}
function EventsTab() {
  const { data, isLoading } = useQuery({ queryKey: ["integration-events"], queryFn: integrationsApi.listEvents });
  const cols: Column<IntegrationEvent>[] = [
    { key: "when", header: "When", cell: (r) => new Date(r.occurredAt).toLocaleString() },
    { key: "type", header: "Event", cell: (r) => <code className="text-xs">{r.eventType}</code> },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  ];
  return <DataTable columns={cols} rows={data} loading={isLoading} emptyTitle="No integration events" />;
}
