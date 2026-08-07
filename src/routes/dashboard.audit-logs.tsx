import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable, TablePagination, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { auditApi } from "@/services/apiClient";
import type { AuditLog } from "@/types/api";
import { buildAuditChanges } from "@/lib/auditDiff";
import { t } from "@/lib/i18n";
import { useLocale } from "@/hooks/useLocale";

export const Route = createFileRoute("/dashboard/audit-logs")({ component: AuditLogsPage });

function actionLabel(action: string) {
  const key = `auditAction.${action.toLowerCase()}`;
  const translated = t(key);
  return translated !== key ? translated : action;
}

function AuditLogsPage() {
  const [locale] = useLocale();
  const [page, setPage] = useState(1);
  const [entityName, setEntityName] = useState("");
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const query = useQuery({
    queryKey: ["audit-logs", page, entityName],
    queryFn: () => auditApi.list({ page, pageSize: 25, entityName: entityName || undefined }),
  });

  const changes = useMemo(
    () =>
      selected
        ? buildAuditChanges(selected.oldValues, selected.newValues, selected.changedFields)
        : [],
    [selected],
  );

  const cols: Column<AuditLog>[] = [
    {
      key: "changedAt",
      header: "When",
      cell: (r) => new Date(r.changedAt).toLocaleString(locale === "ar" ? "ar-EG" : "en-GB"),
    },
    {
      key: "action",
      header: "Action",
      cell: (r) => <StatusBadge tone="info">{actionLabel(r.action)}</StatusBadge>,
    },
    {
      key: "entity",
      header: "Entity",
      cell: (r) => <span className="font-medium">{r.entityDisplay}</span>,
    },
    {
      key: "actor",
      header: "Actor",
      cell: (r) => <span>{r.actorDisplay ?? "—"}</span>,
    },
    {
      key: "expand",
      header: "",
      cell: (r) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSelected(r);
          }}
          className="text-xs font-semibold text-primary hover:underline"
        >
          {t("View changes")}
        </button>
      ),
      className: "text-right",
    },
  ];

  return (
    <>
      <PageHeader title={t("Audit Logs")} description={t("All administrative actions across the platform.")} />
      <div className="mb-4">
        <input
          value={entityName}
          onChange={(e) => {
            setEntityName(e.target.value);
            setPage(1);
          }}
          placeholder={t("Filter by entity type (e.g. Company)")}
          className="h-10 w-72 rounded-[10px] border border-border bg-card px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>
      <DataTable columns={cols} rows={query.data?.items} loading={query.isLoading} emptyTitle={t("No audit logs")} />

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("View changes")}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid gap-2 rounded-xl border border-border bg-muted/30 p-4 text-sm sm:grid-cols-2">
                <div><span className="text-muted-foreground">{t("Entity")}:</span> {selected.entityDisplay}</div>
                <div><span className="text-muted-foreground">{t("Actor")}:</span> {selected.actorDisplay ?? "—"}</div>
                <div><span className="text-muted-foreground">{t("When")}:</span> {new Date(selected.changedAt).toLocaleString(locale === "ar" ? "ar-EG" : "en-GB")}</div>
                <div><span className="text-muted-foreground">{t("Action")}:</span> {actionLabel(selected.action)}</div>
              </div>

              {changes.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-start font-semibold">{t("Field")}</th>
                        <th className="px-3 py-2 text-start font-semibold">{t("Before")}</th>
                        <th className="px-3 py-2 text-start font-semibold">{t("After")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {changes.map((row) => (
                        <tr key={row.field} className="border-t border-border">
                          <td className="px-3 py-2 font-medium">{row.field}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.before}</td>
                          <td className="px-3 py-2 text-foreground">{row.after}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : selected.action === "insert" ? (
                <p className="rounded-xl border border-border bg-primary/5 p-4 text-sm">{t("auditNewRecord")}</p>
              ) : (
                <p className="text-sm text-muted-foreground">{t("auditNoFieldChanges")}</p>
              )}

              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer font-medium text-foreground">{t("Technical details")}</summary>
                <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-muted/40 p-3">{JSON.stringify({ old: selected.oldValues, new: selected.newValues }, null, 2)}</pre>
              </details>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {query.data && query.data.totalItems > 0 && (
        <TablePagination page={query.data.page} pageSize={query.data.pageSize} totalItems={query.data.totalItems} onPageChange={setPage} />
      )}
    </>
  );
}
