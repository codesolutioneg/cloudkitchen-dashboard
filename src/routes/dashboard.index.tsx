import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/app/PageHeader";
import { useAuth } from "@/lib/auth";
import { companiesApi, ordersApi } from "@/services/apiClient";
import {
  Building2, ShoppingBag, ChefHat, Truck, Users, ClipboardCheck,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/")({ component: DashboardHome });

const QUICK = [
  { to: "/dashboard/companies", label: "Companies", desc: "Approve corporate clients", icon: Building2 },
  { to: "/dashboard/orders", label: "Orders", desc: "Track all corporate orders", icon: ShoppingBag },
  { to: "/dashboard/kitchen", label: "Kitchen", desc: "Live prep queue", icon: ChefHat },
  { to: "/dashboard/delivery", label: "Delivery", desc: "Driver assignments", icon: Truck },
  { to: "/dashboard/users", label: "Users", desc: "Dashboard staff & roles", icon: Users },
  { to: "/dashboard/approval-workflows", label: "Approvals", desc: "Pending decisions", icon: ClipboardCheck },
] as const;

function DashboardHome() {
  const { user } = useAuth();
  const activeCos = useQuery({ queryKey: ["kpi-active-companies"], queryFn: () => companiesApi.list({ approvalStatus: "approved", pageSize: 1 }).catch(() => ({ totalItems: 0 })) });
  const orders = useQuery({ queryKey: ["kpi-orders"], queryFn: () => ordersApi.list({ pageSize: 1 }).catch(() => ({ totalItems: 0 })) });
  const inKitchen = useQuery({ queryKey: ["kpi-kitchen"], queryFn: () => ordersApi.list({ statusCode: "preparing", pageSize: 1 }).catch(() => ({ totalItems: 0 })) });
  const delivering = useQuery({ queryKey: ["kpi-delivery"], queryFn: () => ordersApi.list({ statusCode: "out_for_delivery", pageSize: 1 }).catch(() => ({ totalItems: 0 })) });

  const kpis = [
    { label: "Active companies", value: activeCos.data?.totalItems ?? "—", loading: activeCos.isLoading },
    { label: "Total orders", value: orders.data?.totalItems ?? "—", loading: orders.isLoading },
    { label: "In kitchen", value: inKitchen.data?.totalItems ?? "—", loading: inKitchen.isLoading },
    { label: "Out for delivery", value: delivering.data?.totalItems ?? "—", loading: delivering.isLoading },
  ];

  return (
    <>
      <PageHeader
        title={`Welcome${user ? `, ${user.fullName?.split(" ")[0] ?? ""}` : ""}`}
        description="Cloud Kitchen operations overview."
        breadcrumbs={[{ label: "Dashboard" }]}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card-elevated p-5">
            <div className="text-sm text-muted-foreground">{k.label}</div>
            <div className="mt-2 text-3xl font-bold text-foreground">{k.loading ? "…" : k.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">Live</div>
          </div>
        ))}
      </div>

      <h2 className="mt-8 mb-4 text-lg font-semibold text-foreground">Quick access</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {QUICK.map((q) => (
          <Link key={q.to} to={q.to} className="card-elevated group p-5 transition hover:border-primary/40 hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary"><q.icon className="h-5 w-5" /></div>
              <div>
                <div className="font-semibold text-foreground group-hover:text-primary">{q.label}</div>
                <div className="text-xs text-muted-foreground">{q.desc}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
