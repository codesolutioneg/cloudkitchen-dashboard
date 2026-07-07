import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { localizationApi } from "@/services/apiClient";
import type { Language } from "@/types/api";

export const Route = createFileRoute("/dashboard/localization")({ component: LocalizationPage });

function LocalizationPage() {
  const { data, isLoading } = useQuery({ queryKey: ["languages"], queryFn: localizationApi.listLanguages });
  const cols: Column<Language>[] = [
    { key: "code", header: "Code", cell: (r) => <code className="text-xs uppercase">{r.code}</code> },
    { key: "name", header: "Language", cell: (r) => <span className="font-semibold">{r.name}</span> },
    { key: "default", header: "Default", cell: (r) => r.isDefault ? <StatusBadge tone="success">Default</StatusBadge> : <span className="text-muted-foreground">—</span> },
    { key: "active", header: "Status", cell: (r) => <StatusBadge tone={r.isActive ? "success" : "muted"}>{r.isActive ? "Active" : "Inactive"}</StatusBadge> },
  ];
  return (
    <>
      <PageHeader title="Localization" description="Languages and translations for content entities." />
      <DataTable columns={cols} rows={data} loading={isLoading}
        emptyTitle="No languages configured"
        emptyDescription="Add languages so you can translate products, menus and notifications." />
    </>
  );
}
