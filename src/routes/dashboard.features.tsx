import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { featuresApi, featureGroupsApi, modulesApi, featureFlagsApi, dashboardPagesApi } from "@/services/apiClient";
import type { Feature, Module, FeatureFlag, FeatureGroup, DashboardPage } from "@/types/api";

export const Route = createFileRoute("/dashboard/features")({ component: FeaturesPage });

function FeaturesPage() {
  return (
    <>
      <PageHeader title="Features & Modules" description="Platform capability catalog." />
      <Tabs defaultValue="features" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="groups">Feature Groups</TabsTrigger>
          <TabsTrigger value="modules">Modules</TabsTrigger>
          <TabsTrigger value="flags">Feature Flags</TabsTrigger>
          <TabsTrigger value="pages">Dashboard Pages</TabsTrigger>
        </TabsList>
        <TabsContent value="features"><FeaturesTab /></TabsContent>
        <TabsContent value="groups"><GroupsTab /></TabsContent>
        <TabsContent value="modules"><ModulesTab /></TabsContent>
        <TabsContent value="flags"><FlagsTab /></TabsContent>
        <TabsContent value="pages"><PagesTab /></TabsContent>
      </Tabs>
    </>
  );
}

function FeaturesTab() {
  const { data, isLoading } = useQuery({ queryKey: ["features"], queryFn: featuresApi.list });
  const cols: Column<Feature>[] = [
    { key: "code", header: "Code", cell: (r) => <code className="text-xs">{r.code}</code> },
    { key: "name", header: "Name", cell: (r) => <span className="font-semibold">{r.name}</span> },
    { key: "moduleId", header: "Module", cell: (r) => r.moduleId ?? "—" },
    { key: "default", header: "Global default", cell: (r) => <StatusBadge tone={r.isGlobalDefaultEnabled ? "success" : "muted"}>{r.isGlobalDefaultEnabled ? "Enabled" : "Disabled"}</StatusBadge> },
  ];
  return <DataTable columns={cols} rows={data} loading={isLoading} emptyTitle="No features yet" />;
}
function GroupsTab() {
  const { data, isLoading } = useQuery({ queryKey: ["feature-groups"], queryFn: featureGroupsApi.list });
  const cols: Column<FeatureGroup>[] = [
    { key: "code", header: "Code", cell: (r) => <code className="text-xs">{r.code}</code> },
    { key: "name", header: "Name", cell: (r) => r.name },
  ];
  return <DataTable columns={cols} rows={data} loading={isLoading} emptyTitle="No feature groups yet" />;
}
function ModulesTab() {
  const { data, isLoading } = useQuery({ queryKey: ["modules"], queryFn: modulesApi.list });
  const cols: Column<Module>[] = [
    { key: "code", header: "Code", cell: (r) => <code className="text-xs">{r.code}</code> },
    { key: "name", header: "Name", cell: (r) => <span className="font-semibold">{r.name}</span> },
    { key: "audience", header: "Audience", cell: (r) => <StatusBadge tone="info">{r.audience}</StatusBadge> },
    { key: "core", header: "Type", cell: (r) => <StatusBadge tone={r.isCore ? "warning" : "muted"}>{r.isCore ? "Core" : "Optional"}</StatusBadge> },
  ];
  return <DataTable columns={cols} rows={data} loading={isLoading} emptyTitle="No modules yet" />;
}
function FlagsTab() {
  const { data, isLoading } = useQuery({ queryKey: ["feature-flags"], queryFn: featureFlagsApi.list });
  const cols: Column<FeatureFlag>[] = [
    { key: "code", header: "Code", cell: (r) => <code className="text-xs">{r.code}</code> },
    { key: "name", header: "Name", cell: (r) => r.name },
    { key: "on", header: "Enabled", cell: (r) => <StatusBadge tone={r.isEnabled ? "success" : "muted"}>{r.isEnabled ? "On" : "Off"}</StatusBadge> },
  ];
  return <DataTable columns={cols} rows={data} loading={isLoading} emptyTitle="No feature flags yet" />;
}
function PagesTab() {
  const { data, isLoading } = useQuery({ queryKey: ["dashboard-pages"], queryFn: dashboardPagesApi.list });
  const cols: Column<DashboardPage>[] = [
    { key: "code", header: "Code", cell: (r) => <code className="text-xs">{r.code}</code> },
    { key: "name", header: "Name", cell: (r) => <span className="font-semibold">{r.name}</span> },
    { key: "route", header: "Route", cell: (r) => <code className="text-xs">{r.route}</code> },
    { key: "sort", header: "Order", cell: (r) => r.sortOrder },
  ];
  const _unused = useState(0); void _unused;
  return <DataTable columns={cols} rows={data} loading={isLoading} emptyTitle="No dashboard pages registered" />;
}
