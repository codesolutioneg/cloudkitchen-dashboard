import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable, TablePagination, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { jobsApi } from "@/services/apiClient";
import type { BackgroundJob } from "@/types/api";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/jobs")({ component: JobsPage });

function JobsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const query = useQuery({ queryKey: ["jobs", page, status], queryFn: () => jobsApi.list({ page, status: status || undefined }) });

  async function retry(id: string) {
    try { await jobsApi.retry(id); toast.success("Retry queued"); qc.invalidateQueries({ queryKey: ["jobs"] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function cancel(id: string) {
    if (!confirm("Cancel this job?")) return;
    try { await jobsApi.cancel(id); toast.success("Job cancelled"); qc.invalidateQueries({ queryKey: ["jobs"] }); }
    catch (e) { toast.error((e as Error).message); }
  }

  const cols: Column<BackgroundJob>[] = [
    { key: "jobType", header: "Type", cell: (r) => <code className="text-xs">{r.jobType}</code> },
    { key: "queue", header: "Queue", cell: (r) => r.queueName },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    { key: "attempts", header: "Attempts", cell: (r) => r.attempts },
    { key: "createdAt", header: "Created", cell: (r) => new Date(r.createdAt).toLocaleString() },
    { key: "actions", header: "", cell: (r) => (
      <div className="flex justify-end gap-1">
        <button onClick={() => retry(r.id)} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">Retry</button>
        <button onClick={() => cancel(r.id)} className="rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10">Cancel</button>
      </div>
    ), className: "text-right" },
  ];

  return (
    <>
      <PageHeader title="Background Jobs" description="Async processing queue status." />
      <div className="mb-4">
        <input value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          placeholder="Filter by status (e.g. failed)"
          className="h-10 w-72 rounded-[10px] border border-border bg-card px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
      </div>
      <DataTable columns={cols} rows={query.data?.items} loading={query.isLoading} emptyTitle="No jobs" />
      {query.data && query.data.totalItems > 0 && (
        <TablePagination page={query.data.page} pageSize={query.data.pageSize} totalItems={query.data.totalItems} onPageChange={setPage} />
      )}
    </>
  );
}
