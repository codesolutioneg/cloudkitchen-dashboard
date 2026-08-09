import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { EmptyState } from "@/components/app/EmptyState";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { productionApi, type ProductionLine } from "@/services/apiClient";
import { ChefHat, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/dashboard/production")({ component: ProductionPage });

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function ProductionPage() {
  const [date, setDate] = useState(today());

  return (
    <>
      <PageHeader
        title={t("Production")}
        description={t("What the kitchen makes today, across every client.")}
        actions={
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 rounded-[10px] border border-border bg-card px-3 text-sm"
          />
        }
      />
      <Tabs defaultValue="prep">
        <TabsList className="mb-4">
          <TabsTrigger value="prep">{t("Prep list")}</TabsTrigger>
          <TabsTrigger value="packing">{t("By client")}</TabsTrigger>
          <TabsTrigger value="locked">{t("Locked plans")}</TabsTrigger>
        </TabsList>
        <TabsContent value="prep">
          <PrepTab date={date} />
        </TabsContent>
        <TabsContent value="packing">
          <PackingTab date={date} />
        </TabsContent>
        <TabsContent value="locked">
          <LockedTab />
        </TabsContent>
      </Tabs>
    </>
  );
}

function PrepTab({ date }: { date: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["production-day", date],
    queryFn: () => productionApi.day(date),
  });

  const lock = useMutation({
    mutationFn: () => productionApi.lockDay(date),
    onSuccess: (r) => {
      toast.success(`${t("Locked")} v${r.snapshotVersion}`);
      qc.invalidateQueries({ queryKey: ["production-plans"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />;
  const day = q.data;
  if (!day || day.lines.length === 0) {
    return (
      <EmptyState
        title={t("Nothing to cook on this day")}
        description={t("Orders for this delivery date will appear here as they come in.")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label={t("Portions")} value={String(day.totalPortions)} />
        <Stat label={t("Orders")} value={String(day.orderCount)} />
        <Stat label={t("Clients")} value={String(day.companyCount)} />
        <Stat
          label={t("Prep time")}
          value={`${Math.round(day.estimatedPrepMinutes / 60)} ${t("h")}`}
        />
        <Stat
          label={t("Food cost")}
          value={day.cost === null ? t("Unknown") : `${day.cost} ${day.currency}`}
          hint={`${day.costCoveragePercent}% ${t("costed")}`}
        />
      </div>

      {day.currencyMismatch && (
        <p className="rounded-[10px] border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
          {t("This day mixes currencies, so the totals above are not a single figure.")}
        </p>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => lock.mutate()}
          disabled={lock.isPending}
          className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {lock.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Lock className="h-4 w-4" />
          )}
          {t("Lock this day")}
        </button>
      </div>

      <div className="card-elevated overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-start">{t("Dish")}</th>
              <th className="px-3 py-2 text-start">{t("Component")}</th>
              <th className="px-3 py-2 text-start">{t("Make")}</th>
              <th className="px-3 py-2 text-start">{t("Confirmed")}</th>
              <th className="px-3 py-2 text-start">{t("Unconfirmed")}</th>
              <th className="px-3 py-2 text-start">{t("Done")}</th>
              <th className="px-3 py-2 text-start">{t("Clients")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {day.lines.map((line: ProductionLine) => (
              <tr key={`${line.productId}-${line.variantName ?? ""}`}>
                <td className="px-3 py-2 font-semibold">{line.productName}</td>
                <td className="px-3 py-2">
                  {line.componentType ? (
                    <StatusBadge tone="info">{t(line.componentType)}</StatusBadge>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-3 py-2 text-lg font-black text-primary">{line.plannedQty}</td>
                <td className="px-3 py-2">{line.confirmedQty}</td>
                <td className="px-3 py-2">
                  <span className={line.unconfirmedQty > 0 ? "text-warning" : ""}>
                    {line.unconfirmedQty}
                  </span>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{line.producedQty}</td>
                <td className="px-3 py-2">{line.companyCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PackingTab({ date }: { date: string }) {
  const q = useQuery({
    queryKey: ["production-by-company", date],
    queryFn: () => productionApi.byCompany(date),
  });

  if (q.isLoading) return <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />;
  if (!q.data || q.data.length === 0) {
    return <EmptyState title={t("No deliveries on this day")} />;
  }

  return (
    <div className="space-y-3">
      {q.data.map((group) => (
        <div key={group.companyId} className="card-elevated p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-bold">{group.companyName}</h4>
            <span className="text-sm text-muted-foreground">
              {group.portions} {t("portions")} · {group.orderCount} {t("orders")} · {group.total}
            </span>
          </div>
          <ul className="mt-3 space-y-2">
            {group.orders.map((order) => (
              <li key={order.id} className="rounded-xl border border-border bg-surface p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{order.orderNumber}</span>
                  <span className="text-xs text-muted-foreground">
                    {t(order.fulfillmentType)} · {order.status ?? ""}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {order.items.map((i) => `${i.quantity} x ${i.name}`).join(" · ")}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function LockedTab() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["production-plans"],
    queryFn: () => productionApi.listPlans({}),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      productionApi.setStatus(id, status),
    onSuccess: () => {
      toast.success(t("Saved"));
      qc.invalidateQueries({ queryKey: ["production-plans"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />;
  if (!q.data || q.data.length === 0) {
    return (
      <EmptyState
        title={t("No locked plans yet")}
        description={t("Locking a day freezes the sheet the kitchen cooks from.")}
      />
    );
  }

  return (
    <div className="card-elevated divide-y divide-border">
      {q.data.map((plan) => (
        <div key={plan.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <div className="font-bold">
              {plan.date}{" "}
              <span className="text-xs text-muted-foreground">v{plan.snapshotVersion}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {plan.totalPortions} {t("portions")} · {plan.companyCount} {t("clients")}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge tone={plan.status === "completed" ? "success" : "info"}>
              {t(plan.status)}
            </StatusBadge>
            {plan.status === "locked" && (
              <button
                onClick={() => setStatus.mutate({ id: plan.id, status: "in_production" })}
                className="text-xs font-semibold text-primary hover:underline"
              >
                {t("Start")}
              </button>
            )}
            {plan.status === "in_production" && (
              <button
                onClick={() => setStatus.mutate({ id: plan.id, status: "completed" })}
                className="text-xs font-semibold text-primary hover:underline"
              >
                {t("Complete")}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card-elevated p-4">
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-black">{value}</div>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
