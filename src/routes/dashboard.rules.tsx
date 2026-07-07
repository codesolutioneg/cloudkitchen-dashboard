import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { rulesApi } from "@/services/apiClient";
import type { RuleType, BusinessRule, Calendar } from "@/types/api";

export const Route = createFileRoute("/dashboard/rules")({ component: RulesPage });

function RulesPage() {
  return (
    <>
      <PageHeader title="Business Rules" description="Configurable operational rules and calendars." />
      <Tabs defaultValue="rule-types" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="rule-types">Rule Types</TabsTrigger>
          <TabsTrigger value="business-rules">Business Rules</TabsTrigger>
          <TabsTrigger value="calendars">Calendars</TabsTrigger>
        </TabsList>
        <TabsContent value="rule-types"><RuleTypesTab /></TabsContent>
        <TabsContent value="business-rules"><BusinessRulesTab /></TabsContent>
        <TabsContent value="calendars"><CalendarsTab /></TabsContent>
      </Tabs>
    </>
  );
}

function RuleTypesTab() {
  const { data, isLoading } = useQuery({ queryKey: ["rule-types"], queryFn: rulesApi.listRuleTypes });
  const cols: Column<RuleType>[] = [
    { key: "code", header: "Code", cell: (r) => <code className="text-xs">{r.code}</code> },
    { key: "name", header: "Name", cell: (r) => <span className="font-semibold">{r.name}</span> },
    { key: "schema", header: "Has schema", cell: (r) => <StatusBadge tone={r.valueSchema ? "success" : "muted"}>{r.valueSchema ? "Yes" : "No"}</StatusBadge> },
  ];
  return <DataTable columns={cols} rows={data} loading={isLoading} emptyTitle="No rule types" />;
}
function BusinessRulesTab() {
  const { data, isLoading } = useQuery({ queryKey: ["business-rules"], queryFn: rulesApi.listBusinessRules });
  const cols: Column<BusinessRule>[] = [
    { key: "scope", header: "Scope", cell: (r) => <StatusBadge tone="info">{r.scopeType}</StatusBadge> },
    { key: "scopeId", header: "Scope ID", cell: (r) => r.scopeId ?? "—" },
    { key: "priority", header: "Priority", cell: (r) => r.priority },
    { key: "active", header: "Status", cell: (r) => <StatusBadge tone={r.isActive ? "success" : "muted"}>{r.isActive ? "Active" : "Inactive"}</StatusBadge> },
    { key: "value", header: "Value", cell: (r) => <code className="text-xs">{JSON.stringify(r.value).slice(0, 40)}…</code> },
  ];
  return <DataTable columns={cols} rows={data} loading={isLoading} emptyTitle="No business rules configured" />;
}
function CalendarsTab() {
  const { data, isLoading } = useQuery({ queryKey: ["calendars"], queryFn: rulesApi.listCalendars });
  const cols: Column<Calendar>[] = [
    { key: "code", header: "Code", cell: (r) => <code className="text-xs">{r.code}</code> },
    { key: "name", header: "Name", cell: (r) => <span className="font-semibold">{r.name}</span> },
    { key: "tz", header: "Timezone", cell: (r) => r.timezone },
  ];
  return <DataTable columns={cols} rows={data} loading={isLoading} emptyTitle="No calendars" />;
}
