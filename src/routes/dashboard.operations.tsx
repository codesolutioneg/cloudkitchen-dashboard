import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/app/StatusBadge";
import { EmptyState } from "@/components/app/EmptyState";
import { ordersApi, deliveryApi } from "@/services/apiClient";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/operations")({ component: OperationsPage });

function OperationsPage() {
  return (
    <>
      <PageHeader title="Operations Desk" description="Dispatch delivery orders and manage pickup handoffs." />
      <Tabs defaultValue="dispatch" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="dispatch">Ready for dispatch</TabsTrigger>
          <TabsTrigger value="pickup">Ready pickup</TabsTrigger>
          <TabsTrigger value="awaiting">Awaiting pickup</TabsTrigger>
        </TabsList>
        <TabsContent value="dispatch"><DispatchTab /></TabsContent>
        <TabsContent value="pickup"><PickupTab /></TabsContent>
        <TabsContent value="awaiting"><AwaitingTab /></TabsContent>
      </Tabs>
    </>
  );
}

function DispatchTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["ops-ready-delivery"], queryFn: () => ordersApi.list({ statusCode: "ready" }) });
  const drivers = useQuery({ queryKey: ["delivery-users"], queryFn: deliveryApi.users });
  const [assignments, setAssignments] = useState<Record<string, string>>({});

  async function assign(orderId: string) {
    const uid = assignments[orderId];
    if (!uid) { toast.error("Pick a driver first"); return; }
    try { await deliveryApi.users; await ordersApi.assignDelivery(orderId, uid); toast.success("Driver assigned"); qc.invalidateQueries({ queryKey: ["ops-ready-delivery"] }); }
    catch (e) { toast.error((e as Error).message); }
  }

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  const deliveryOrders = data?.items.filter((o) => o.fulfillmentType === "delivery") ?? [];
  if (deliveryOrders.length === 0) return <EmptyState title="Nothing to dispatch" description="Ready delivery orders will show here." />;

  return (
    <div className="space-y-3">
      {deliveryOrders.map((o) => (
        <div key={o.id} className="card-elevated flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <Link to="/dashboard/orders/$id" params={{ id: o.id }} className="font-semibold text-primary hover:underline">{o.orderNumber}</Link>
            <div className="text-xs text-muted-foreground">Due {new Date(o.requestedDeliveryAt).toLocaleTimeString()} · {o.totalAmount} {o.currency}</div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={assignments[o.id] ?? ""}
              onChange={(e) => setAssignments((a) => ({ ...a, [o.id]: e.target.value }))}
              className="h-9 rounded-md border border-border bg-card px-2 text-sm"
            >
              <option value="">Select driver…</option>
              {drivers.data?.filter((d) => d.isAvailable).map((d) => (
                <option key={d.id} value={d.id}>{d.fullName}</option>
              ))}
            </select>
            <button onClick={() => assign(o.id)} className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-[oklch(0.52_0.19_285)]">Assign</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function PickupTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["ops-ready-pickup"], queryFn: () => ordersApi.list({ statusCode: "ready" }) });
  async function mark(id: string) {
    try { await ordersApi.awaitingPickup(id); toast.success("Marked awaiting pickup"); qc.invalidateQueries({ queryKey: ["ops-ready-pickup"] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  const pickup = data?.items.filter((o) => o.fulfillmentType === "pickup") ?? [];
  if (pickup.length === 0) return <EmptyState title="No pickup orders ready" />;
  return (
    <div className="space-y-3">
      {pickup.map((o) => (
        <div key={o.id} className="card-elevated flex items-center justify-between gap-3 p-4">
          <Link to="/dashboard/orders/$id" params={{ id: o.id }} className="font-semibold text-primary hover:underline">{o.orderNumber}</Link>
          <button onClick={() => mark(o.id)} className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-[oklch(0.52_0.19_285)]">Mark awaiting pickup</button>
        </div>
      ))}
    </div>
  );
}

function AwaitingTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["ops-awaiting"], queryFn: () => ordersApi.list({ statusCode: "awaiting_pickup" }) });
  async function confirm(id: string) {
    try { await ordersApi.confirmPickup(id); toast.success("Pickup confirmed"); qc.invalidateQueries({ queryKey: ["ops-awaiting"] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (!data || data.items.length === 0) return <EmptyState title="No pickups awaiting" />;
  return (
    <div className="space-y-3">
      {data.items.map((o) => (
        <div key={o.id} className="card-elevated flex items-center justify-between gap-3 p-4">
          <div>
            <Link to="/dashboard/orders/$id" params={{ id: o.id }} className="font-semibold text-primary hover:underline">{o.orderNumber}</Link>
            <div className="text-xs text-muted-foreground"><StatusBadge status="awaiting_pickup" /></div>
          </div>
          <button onClick={() => confirm(o.id)} className="rounded-md bg-success px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Confirm pickup</button>
        </div>
      ))}
    </div>
  );
}
