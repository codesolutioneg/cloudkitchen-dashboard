import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable, TablePagination, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { companiesApi, ordersApi } from "@/services/apiClient";
import type { OrderSummary } from "@/types/api";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/dashboard/orders/")({ component: OrdersPage });

const STATUSES = ["", "submitted", "pending_approval", "kitchen_accepted", "preparing", "ready", "out_for_delivery", "delivered", "awaiting_pickup", "picked_up", "cancelled"];

function OrdersPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("");
  const [companyId, setCompanyId] = useState<string>("");
  const companies = useQuery({ queryKey: ["companies-select"], queryFn: () => companiesApi.list({ pageSize: 100 }).catch(() => ({ items: [] as never[] })) });
  const query = useQuery({
    queryKey: ["orders", page, status, companyId],
    queryFn: () => ordersApi.list({ page, pageSize: 20, statusCode: status || undefined, companyId: companyId || undefined }),
  });

  const cols: Column<OrderSummary>[] = [
    { key: "orderNumber", header: "Order #", cell: (r) => <Link to="/dashboard/orders/$id" params={{ id: r.id }} className="font-semibold text-primary hover:underline">{r.orderNumber}</Link> },
    { key: "type", header: "Type", cell: (r) => <StatusBadge tone={r.fulfillmentType === "delivery" ? "info" : "warning"}>{r.fulfillmentType}</StatusBadge> },
    { key: "step", header: "Current step", cell: (r) => r.currentStepCode ? <StatusBadge status={r.currentStepCode} /> : <span className="text-muted-foreground">—</span> },
    { key: "total", header: "Total", cell: (r) => `${r.totalAmount} ${r.currency}` },
    { key: "requested", header: "Requested for", cell: (r) => new Date(r.requestedDeliveryAt).toLocaleString() },
  ];

  return (
    <>
      <PageHeader title={t("Orders")} description={t("All corporate orders across companies.")} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-10 rounded-[10px] border border-border bg-card px-3 text-sm">
          {STATUSES.map((s) => <option key={s} value={s}>{s || "All statuses"}</option>)}
        </select>
        <select value={companyId} onChange={(e) => { setCompanyId(e.target.value); setPage(1); }} className="h-10 rounded-[10px] border border-border bg-card px-3 text-sm">
          <option value="">All companies</option>
          {companies.data && "items" in companies.data && companies.data.items.map((c) => <option key={c.id} value={c.id}>{c.legalName}</option>)}
        </select>
      </div>
      <DataTable columns={cols} rows={query.data?.items} loading={query.isLoading}
        emptyTitle={t("No orders yet")} emptyDescription={t("Orders placed by companies will appear here.")} />
      {query.data && query.data.totalItems > 0 && (
        <TablePagination page={query.data.page} pageSize={query.data.pageSize} totalItems={query.data.totalItems} onPageChange={setPage} />
      )}
    </>
  );
}
