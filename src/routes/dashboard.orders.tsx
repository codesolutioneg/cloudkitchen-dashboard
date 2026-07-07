import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable, TablePagination, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { ordersApi } from "@/services/apiClient";
import type { OrderSummary } from "@/types/api";

export const Route = createFileRoute("/dashboard/orders")({ component: OrdersPage });

function OrdersPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("");
  const query = useQuery({
    queryKey: ["orders", page, status],
    queryFn: () => ordersApi.list({ page, pageSize: 20, statusCode: status || undefined }),
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
      <PageHeader title="Orders" description="All corporate orders across companies." />
      <div className="mb-4 flex items-center gap-3">
        <input
          value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          placeholder="Filter by status code (e.g. preparing)"
          className="h-10 w-72 rounded-[10px] border border-border bg-card px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>
      <DataTable columns={cols} rows={query.data?.items} loading={query.isLoading}
        emptyTitle="No orders yet" emptyDescription="Orders placed by companies will appear here." />
      {query.data && query.data.totalItems > 0 && (
        <TablePagination page={query.data.page} pageSize={query.data.pageSize} totalItems={query.data.totalItems} onPageChange={setPage} />
      )}
    </>
  );
}
