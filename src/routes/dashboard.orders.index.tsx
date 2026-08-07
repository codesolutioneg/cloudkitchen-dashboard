import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable, TablePagination, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { EntitySelect } from "@/components/app/EntitySelect";
import { companiesApi, ordersApi } from "@/services/apiClient";
import type { OrderSummary } from "@/types/api";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/dashboard/orders/")({ component: OrdersPage });

const STATUS_OPTIONS = [
  { value: "submitted", labelKey: "Submitted" },
  { value: "pending_approval", labelKey: "Pending approval" },
  { value: "kitchen_accepted", labelKey: "Kitchen accepted" },
  { value: "preparing", labelKey: "Preparing" },
  { value: "ready", labelKey: "Ready" },
  { value: "out_for_delivery", labelKey: "Out for delivery" },
  { value: "delivered", labelKey: "Delivered" },
  { value: "awaiting_pickup", labelKey: "Awaiting pickup" },
  { value: "picked_up", labelKey: "Picked up" },
  { value: "cancelled", labelKey: "Cancelled" },
];

function OrdersPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("");
  const [companyId, setCompanyId] = useState<string>("");
  const companies = useQuery({
    queryKey: ["companies-select"],
    queryFn: () => companiesApi.list({ pageSize: 100 }).catch(() => ({ items: [] as never[] })),
  });
  const query = useQuery({
    queryKey: ["orders", page, status, companyId],
    queryFn: () => ordersApi.list({ page, pageSize: 20, statusCode: status || undefined, companyId: companyId || undefined }),
  });

  const cols: Column<OrderSummary>[] = [
    {
      key: "orderNumber",
      header: "Order #",
      cell: (r) => (
        <Link to="/dashboard/orders/$id" params={{ id: r.id }} className="font-semibold text-primary hover:underline">
          {r.orderNumber}
        </Link>
      ),
    },
    {
      key: "type",
      header: "Type",
      cell: (r) => (
        <StatusBadge tone={r.fulfillmentType === "delivery" ? "info" : "warning"}>
          {r.fulfillmentType === "delivery" ? t("Delivery") : t("Pickup")}
        </StatusBadge>
      ),
    },
    {
      key: "step",
      header: "Current step",
      cell: (r) => (r.currentStepCode ? <StatusBadge status={r.currentStepCode} /> : <span className="text-muted-foreground">—</span>),
    },
    { key: "total", header: "Total", cell: (r) => `${r.totalAmount} ${r.currency}` },
    { key: "requested", header: "Requested for", cell: (r) => new Date(r.requestedDeliveryAt).toLocaleString() },
  ];

  return (
    <>
      <PageHeader title={t("Orders")} description={t("All corporate orders across companies.")} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <EntitySelect
          value={status}
          onChange={(v) => { setStatus(v); setPage(1); }}
          options={STATUS_OPTIONS.map((s) => ({ value: s.value, label: t(s.labelKey) }))}
          placeholder={t("All statuses")}
          className="w-[220px]"
        />
        <EntitySelect
          value={companyId}
          onChange={(v) => { setCompanyId(v); setPage(1); }}
          placeholder={t("All companies")}
          options={(companies.data?.items ?? []).map((c) => ({
            value: c.id,
            label: c.tradeName ?? c.legalName,
          }))}
          className="min-w-[240px]"
        />
      </div>
      <DataTable
        columns={cols}
        rows={query.data?.items}
        loading={query.isLoading}
        emptyTitle={t("No orders yet")}
        emptyDescription={t("Orders placed by companies will appear here.")}
      />
      {query.data && query.data.totalItems > 0 && (
        <TablePagination
          page={query.data.page}
          pageSize={query.data.pageSize}
          totalItems={query.data.totalItems}
          onPageChange={setPage}
        />
      )}
    </>
  );
}
