import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable, TablePagination, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { jobsApi } from "@/services/apiClient";
import type { BackgroundJob } from "@/types/api";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/dashboard/jobs")({ component: JobsPage });

function JobsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["jobs", page, status], queryFn: () => jobsApi.list({ page, status: status || undefined }) });
  const detail = useQuery({ queryKey: ["job", selectedId], enabled: !!selectedId, queryFn: () => jobsApi.get(selectedId!).catch(() => null) });

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
      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => retry(r.id)} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">{t("Retry")}</button>
        <button onClick={() => cancel(r.id)} className="rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10">{t("Cancel")}</button>
      </div>
    ), className: "text-right" },
  ];

  return (
    <>
      <PageHeader title={t("Background Jobs")} description={t("Async processing queue status.")} />
      <div className="mb-4 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        {t("jobsGuide")}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-10 rounded-[10px] border border-border bg-card px-3 text-sm">
          <option value="">{t("All statuses")}</option>
          <option value="pending">{t("Pending")}</option>
          <option value="failed">{t("Failed")}</option>
          <option value="completed">{t("Completed")}</option>
        </select>
      </div>
      <DataTable columns={cols} rows={query.data?.items} loading={query.isLoading} onRowClick={(r) => setSelectedId(r.id)} emptyTitle={t("No jobs")} />
      {query.data && query.data.totalItems > 0 && (
        <TablePagination page={query.data.page} pageSize={query.data.pageSize} totalItems={query.data.totalItems} onPageChange={setPage} />
      )}

      <Sheet open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader><SheetTitle>Job detail</SheetTitle></SheetHeader>
          {detail.isLoading ? <Loader2 className="mt-6 h-6 w-6 animate-spin text-primary" /> :
            !detail.data ? <p className="mt-6 text-sm text-muted-foreground">Not found.</p> : (
              <div className="mt-6 space-y-3 px-4 text-sm">
                <div><span className="text-muted-foreground">Type: </span><code>{detail.data.jobType}</code></div>
                <div><span className="text-muted-foreground">Queue: </span>{detail.data.queueName}</div>
                <div><span className="text-muted-foreground">Status: </span><StatusBadge status={detail.data.status} /></div>
                <div><span className="text-muted-foreground">Attempts: </span>{detail.data.attempts}</div>
                <div><span className="text-muted-foreground">Created: </span>{new Date(detail.data.createdAt).toLocaleString()}</div>
                <pre className="rounded-lg border border-border bg-muted/40 p-3 text-xs overflow-auto max-h-[400px]">{JSON.stringify(detail.data, null, 2)}</pre>
              </div>
            )}
        </SheetContent>
      </Sheet>
    </>
  );
}
