import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable, TablePagination, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { auditApi } from "@/services/apiClient";
import type { AuditLog } from "@/types/api";

export const Route = createFileRoute("/dashboard/audit-logs")({ component: AuditLogsPage });

function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["audit-logs", page, entityType],
    queryFn: () => auditApi.list({ page, pageSize: 25, entityType: entityType || undefined }),
  });

  const cols: Column<AuditLog>[] = [
    { key: "occurredAt", header: "When", cell: (r) => new Date(r.occurredAt).toLocaleString() },
    { key: "action", header: "Action", cell: (r) => <StatusBadge tone="info">{r.action}</StatusBadge> },
    { key: "entity", header: "Entity", cell: (r) => `${r.entityType} · ${r.entityId.slice(0, 8)}…` },
    { key: "actor", header: "Actor", cell: (r) => r.actorType ? `${r.actorType} · ${r.actorId?.slice(0, 8) ?? "—"}` : "—" },
    { key: "expand", header: "", cell: (r) => (
      <button onClick={(e) => { e.stopPropagation(); setExpanded((cur) => cur === r.id ? null : r.id); }} className="text-xs text-primary hover:underline">
        {expanded === r.id ? "Hide" : "View changes"}
      </button>
    ), className: "text-right" },
  ];

  return (
    <>
      <PageHeader title="Audit Logs" description="All administrative actions across the platform." />
      <div className="mb-4">
        <input value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }}
          placeholder="Filter by entity type (e.g. company)"
          className="h-10 w-72 rounded-[10px] border border-border bg-card px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
      </div>
      <DataTable columns={cols} rows={query.data?.items} loading={query.isLoading} emptyTitle="No audit logs" />
      {expanded && query.data?.items.find((l) => l.id === expanded) && (
        <pre className="mt-4 max-h-80 overflow-auto rounded-xl border border-border bg-card p-4 text-xs">
{JSON.stringify(query.data.items.find((l) => l.id === expanded)?.changes, null, 2)}
        </pre>
      )}
      {query.data && query.data.totalItems > 0 && (
        <TablePagination page={query.data.page} pageSize={query.data.pageSize} totalItems={query.data.totalItems} onPageChange={setPage} />
      )}
    </>
  );
}
