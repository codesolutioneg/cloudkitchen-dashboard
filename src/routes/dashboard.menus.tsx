import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { menusApi } from "@/services/apiClient";
import type { Menu } from "@/types/api";

export const Route = createFileRoute("/dashboard/menus")({ component: MenusPage });

function MenusPage() {
  const { data, isLoading } = useQuery({ queryKey: ["menus"], queryFn: menusApi.list });
  const cols: Column<Menu>[] = [
    { key: "name", header: "Menu", cell: (r) => <span className="font-semibold">{r.name}</span> },
    { key: "type", header: "Type", cell: (r) => <StatusBadge tone="info">{r.menuType}</StatusBadge> },
    { key: "active", header: "Status", cell: (r) => <StatusBadge tone={r.isActive ? "success" : "muted"}>{r.isActive ? "Active" : "Inactive"}</StatusBadge> },
  ];
  return (
    <>
      <PageHeader title="Menus" description="Group products into menus and assign to companies." />
      <DataTable columns={cols} rows={data} loading={isLoading}
        emptyTitle="No menus yet" emptyDescription="Create a menu to bundle products for corporate clients." />
    </>
  );
}
