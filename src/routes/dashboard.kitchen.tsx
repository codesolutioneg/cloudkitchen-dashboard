import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { EmptyState } from "@/components/app/EmptyState";
import { ordersApi, workflowsApi } from "@/services/apiClient";
import type { OrderSummary } from "@/types/api";
import { ChefHat, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/dashboard/kitchen")({ component: KitchenPage });

const COLUMNS: Array<{ code: string; title: string; nextCode?: string }> = [
  { code: "kitchen_accepted", title: "Incoming", nextCode: "preparing" },
  { code: "preparing", title: "Preparing", nextCode: "ready" },
  { code: "ready", title: "Ready" },
];

function KitchenPage() {
  return (
    <>
      <PageHeader title={t("Kitchen")} description={t("Live operations queue for the kitchen team.")} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {COLUMNS.map((c) => <KanbanColumn key={c.code} {...c} />)}
      </div>
    </>
  );
}

function KanbanColumn({ code, title, nextCode }: { code: string; title: string; nextCode?: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["orders-kitchen", code], queryFn: () => ordersApi.list({ statusCode: code, pageSize: 30 }) });
  const wf = useQuery({ queryKey: ["order-wf-kitchen"], queryFn: () => workflowsApi.list({ workflowType: "order" }).catch(() => [] as never[]) });
  const steps = useQuery({ queryKey: ["wf-steps-kitchen", wf.data?.[0]?.id], enabled: !!wf.data?.[0]?.id, queryFn: () => workflowsApi.listSteps(wf.data![0].id).catch(() => [] as never[]) });
  const nextStepId = nextCode ? steps.data?.find((s) => s.code === nextCode)?.id : undefined;

  async function advance(orderId: string) {
    if (!nextStepId) { toast.error("Next step not found"); return; }
    try { await ordersApi.transition(orderId, { toStepId: nextStepId }); toast.success("Advanced"); qc.invalidateQueries({ queryKey: ["orders-kitchen"] }); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        <StatusBadge status={code}>{data?.totalItems ?? 0}</StatusBadge>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={<ChefHat className="h-5 w-5" />} title={t("Nothing here")} description={t("Orders will queue up as they progress.")} />
      ) : (
        <div className="space-y-2">
          {data.items.map((o: OrderSummary) => (
            <div key={o.id} className="rounded-xl border border-border bg-card p-3 transition hover:border-primary/40 hover:shadow-sm">
              <Link to="/dashboard/orders/$id" params={{ id: o.id }} className="block">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-primary">{o.orderNumber}</span>
                  <StatusBadge tone={o.fulfillmentType === "delivery" ? "info" : "warning"}>{o.fulfillmentType}</StatusBadge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">Due {new Date(o.requestedDeliveryAt).toLocaleTimeString()}</div>
                <div className="mt-1 text-sm font-medium">{o.totalAmount} {o.currency}</div>
              </Link>
              {nextCode && (
                <button onClick={() => advance(o.id)} className="mt-2 flex w-full items-center justify-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground hover:bg-[oklch(0.52_0.19_285)]">
                  Advance to {nextCode.replaceAll("_", " ")} <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
