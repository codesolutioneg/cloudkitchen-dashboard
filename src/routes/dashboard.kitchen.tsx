import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { EmptyState } from "@/components/app/EmptyState";
import { ordersApi } from "@/services/apiClient";
import type { OrderSummary } from "@/types/api";
import { ChefHat, Loader2 } from "lucide-react";

export const Route = createFileRoute("/dashboard/kitchen")({ component: KitchenPage });

const COLUMNS: Array<{ code: string; title: string }> = [
  { code: "kitchen_accepted", title: "Incoming" },
  { code: "preparing", title: "Preparing" },
  { code: "ready", title: "Ready" },
];

function KitchenPage() {
  return (
    <>
      <PageHeader title="Kitchen" description="Live operations queue for the kitchen team." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {COLUMNS.map((c) => <KanbanColumn key={c.code} statusCode={c.code} title={c.title} />)}
      </div>
    </>
  );
}

function KanbanColumn({ statusCode, title }: { statusCode: string; title: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["orders-kitchen", statusCode],
    queryFn: () => ordersApi.list({ statusCode, pageSize: 30 }),
  });
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        <StatusBadge status={statusCode}>{data?.totalItems ?? 0}</StatusBadge>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={<ChefHat className="h-5 w-5" />} title="Nothing here" description="Orders will queue up as they progress." />
      ) : (
        <div className="space-y-2">
          {data.items.map((o: OrderSummary) => (
            <Link key={o.id} to="/dashboard/orders/$id" params={{ id: o.id }}
              className="block rounded-xl border border-border bg-card p-3 transition hover:border-primary/40 hover:shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-primary">{o.orderNumber}</span>
                <StatusBadge tone={o.fulfillmentType === "delivery" ? "info" : "warning"}>{o.fulfillmentType}</StatusBadge>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Due {new Date(o.requestedDeliveryAt).toLocaleTimeString()}
              </div>
              <div className="mt-1 text-sm font-medium">{o.totalAmount} {o.currency}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
