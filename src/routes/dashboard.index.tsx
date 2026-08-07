import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Building2, ShoppingBag, ChefHat, Truck, Users, ClipboardCheck,
  Loader2, ArrowLeft, TrendingUp, Package,
} from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { useAuth } from "@/lib/auth";
import { analyticsApi, companiesApi, deliveryApi } from "@/services/apiClient";
import { EntitySelect } from "@/components/app/EntitySelect";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { usePlatformDefaults } from "@/hooks/usePlatformDefaults";

export const Route = createFileRoute("/dashboard/")({ component: DashboardHome });

const ADMIN_QUICK = [
  { to: "/dashboard/companies", label: "Companies", desc: "Approve corporate clients", icon: Building2 },
  { to: "/dashboard/orders", label: "Orders", desc: "Track all corporate orders", icon: ShoppingBag },
  { to: "/dashboard/kitchen", label: "Kitchen", desc: "Live prep queue", icon: ChefHat },
  { to: "/dashboard/delivery", label: "Delivery", desc: "Driver assignments", icon: Truck },
  { to: "/dashboard/users", label: "Users", desc: "Dashboard staff & roles", icon: Users },
  { to: "/dashboard/approval-workflows", label: "Approvals", desc: "Pending decisions", icon: ClipboardCheck },
] as const;

const STATUS_COLORS = ["#6366f1", "#06b6d4", "#f59e0b", "#10b981", "#f97316", "#ef4444", "#8b5cf6", "#64748b"];
const PERIODS = [7, 30, 90] as const;

function hasRole(roles: { name: string }[] | undefined, names: string[]) {
  const set = new Set((roles ?? []).map((r) => r.name.toLowerCase()));
  return names.some((n) => set.has(n.toLowerCase()));
}

function money(v: string | number, currency: string) {
  const n = typeof v === "string" ? Number(v) : v;
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;
}

function DashboardHome() {
  const { user, navigation } = useAuth();
  const isDeliveryOnly =
    hasRole(user?.roles, ["Delivery"]) &&
    !hasRole(user?.roles, ["Super Admin"]) &&
    navigation.length > 0 &&
    navigation.every((n) => n.route === "/dashboard/delivery" || n.route === "/dashboard");

  if (isDeliveryOnly) return <DeliveryHome />;
  return <AdminAnalyticsHome />;
}

function DeliveryHome() {
  const { user } = useAuth();
  const myOrders = useQuery({ queryKey: ["my-delivery-orders"], queryFn: deliveryApi.myOrders });
  const orders = myOrders.data ?? [];
  const readyCount = orders.filter((o) => o.currentStepCode === "ready").length;
  const outCount = orders.filter((o) => o.currentStepCode === "out_for_delivery").length;

  return (
    <>
      <PageHeader
        title={user?.fullName ? `${t("Welcome")}، ${user.fullName.split(" ")[0]}` : t("Welcome")}
        description={t("Your delivery assignments for today.")}
        breadcrumbs={[{ label: t("Dashboard") }]}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: t("Assigned to you"), value: orders.length, loading: myOrders.isLoading },
          { label: t("Ready to depart"), value: readyCount, loading: myOrders.isLoading },
          { label: t("Out for delivery"), value: outCount, loading: myOrders.isLoading },
        ].map((k) => (
          <div key={k.label} className="card-elevated p-5">
            <div className="text-sm text-muted-foreground">{k.label}</div>
            <div className="mt-2 text-3xl font-bold">{k.loading ? "…" : k.value}</div>
          </div>
        ))}
      </div>
      <div className="mt-8 card-elevated p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{t("Delivery board")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {orders.length === 0
                ? t("Orders will appear here when dispatch assigns you.")
                : t("Open your board to depart and confirm deliveries.")}
            </p>
          </div>
          <Link to="/dashboard/delivery" className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
            <Truck className="h-4 w-4" /> {t("Open delivery")} <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </>
  );
}

function AdminAnalyticsHome() {
  const { user, navigation } = useAuth();
  const { currency: settingsCurrency } = usePlatformDefaults();
  const [days, setDays] = useState<number>(30);
  const [companyId, setCompanyId] = useState("");

  const cos = useQuery({
    queryKey: ["analytics-companies"],
    queryFn: () => companiesApi.list({ approvalStatus: "approved", pageSize: 100 }).catch(() => ({ items: [], totalItems: 0 })),
  });

  const overview = useQuery({
    queryKey: ["analytics-overview", days, companyId || "all"],
    queryFn: () => analyticsApi.overview({ days, companyId: companyId || undefined }),
    retry: false,
  });

  const currency = overview.data?.currency || settingsCurrency;
  const fmt = (v: string | number, cur?: string) => money(v, cur || currency);

  const quick = useMemo(() => {
    if (navigation.length === 0) return ADMIN_QUICK;
    const allowed = new Set(navigation.filter((n) => n.permissions.canView).map((n) => n.route));
    return ADMIN_QUICK.filter((q) => allowed.has(q.to));
  }, [navigation]);

  if (overview.isError) {
    return (
      <>
        <PageHeader
          title={user?.fullName ? `${t("Welcome")}، ${user.fullName.split(" ")[0]}` : t("Welcome")}
          description={t("Cloud Kitchen operations overview.")}
          breadcrumbs={[{ label: t("Dashboard") }]}
        />
        <div className="card-elevated p-6 text-sm text-muted-foreground">
          {(overview.error as Error).message || t("Analytics unavailable for this role.")}
        </div>
        {quick.length > 0 && (
          <>
            <h2 className="mt-8 mb-4 text-lg font-semibold">{t("Quick access")}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {quick.map((q) => (
                <Link key={q.to} to={q.to} className="card-elevated group p-5 transition hover:border-primary/40">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary"><q.icon className="h-5 w-5" /></div>
                    <div>
                      <div className="font-semibold group-hover:text-primary">{t(q.label)}</div>
                      <div className="text-xs text-muted-foreground">{t(q.desc)}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </>
    );
  }

  const data = overview.data;
  const kpis = data?.kpis;

  return (
    <>
      <div className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-[color-mix(in_srgb,var(--primary)_70%,#1e3a8a)] p-6 text-primary-foreground shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/70">{t("Analytics")}</div>
            <h1 className="text-3xl font-bold tracking-tight">
              {user?.fullName ? `${t("Welcome")}، ${user.fullName.split(" ")[0]}` : t("Welcome")}
            </h1>
            <p className="mt-1 max-w-xl text-sm text-white/80">{t("Sales, companies, and order performance.")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl bg-white/10 p-1 backdrop-blur">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setDays(p)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                    days === p ? "bg-white text-primary" : "text-white/80 hover:bg-white/10",
                  )}
                >
                  {p}D
                </button>
              ))}
            </div>
            <div className="min-w-[220px]">
              <EntitySelect
                value={companyId}
                onChange={setCompanyId}
                placeholder={t("All companies")}
                options={(cos.data?.items ?? []).map((c) => ({
                  value: c.id,
                  label: c.tradeName ?? c.legalName,
                  hint: c.city ?? undefined,
                }))}
                className="border-white/20 bg-white/10 text-white"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overview.isLoading || !kpis ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="card-elevated h-28 animate-pulse bg-muted/40" />)
        ) : (
          <>
            <KpiCard label={t("Active companies")} value={String(kpis.activeCompanies)} icon={Building2} hint={t("Approved clients")} />
            <KpiCard
              label={t("Orders today")}
              value={String(kpis.ordersToday)}
              icon={ShoppingBag}
              trend={kpis.ordersTrendPct}
            />
            <KpiCard
              label={t("Revenue today")}
              value={fmt(kpis.revenueToday)}
              icon={TrendingUp}
              trend={kpis.revenueTrendPct}
            />
            <KpiCard
              label={t(`Sales (${days}D)`)}
              value={fmt(kpis.revenueInRange)}
              icon={Package}
              hint={`${kpis.ordersInRange} ${t("orders")}`}
            />
          </>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card-elevated p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">{t("Sales over time")}</h2>
            <span className="text-xs text-muted-foreground">{days}D</span>
          </div>
          {overview.isLoading || !data ? (
            <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.salesSeries}>
                  <defs>
                    <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => String(v).slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} width={48} />
                  <Tooltip formatter={(v: number) => fmt(v)} labelFormatter={(l) => String(l)} />
                  <Area type="monotone" dataKey="revenue" stroke="var(--primary)" fill="url(#revFill)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card-elevated p-5">
          <h2 className="mb-4 font-semibold">{t("Orders by status")}</h2>
          {overview.isLoading || !data ? (
            <div className="flex h-64 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : data.statusBreakdown.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">{t("No orders in range")}</p>
          ) : (
            <>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.statusBreakdown} dataKey="count" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2}>
                      {data.statusBreakdown.map((_, i) => (
                        <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 space-y-1.5">
                {data.statusBreakdown.map((s, i) => (
                  <li key={s.code} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLORS[i % STATUS_COLORS.length] }} />
                      {s.name}
                    </span>
                    <span className="font-semibold">{s.count}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card-elevated p-5">
          <h2 className="mb-1 font-semibold">{t("Top companies by sales")}</h2>
          <p className="mb-4 text-xs text-muted-foreground">{t("Which companies order the most in this period.")}</p>
          {overview.isLoading || !data ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : data.topCompanies.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("No sales data yet")}</p>
          ) : (
            <div className="space-y-2">
              {data.topCompanies.map((c, idx) => {
                const max = Number(data.topCompanies[0]?.revenue ?? 1) || 1;
                const pct = Math.max(6, (Number(c.revenue) / max) * 100);
                return (
                  <div key={c.companyId} className="rounded-xl border border-border p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">
                          <span className="mr-2 text-muted-foreground">#{idx + 1}</span>
                          {c.tradeName ?? c.legalName}
                        </div>
                        <div className="text-xs text-muted-foreground">{c.city ?? "—"} · {c.orderCount} {t("orders")}</div>
                      </div>
                      <div className="shrink-0 text-sm font-bold text-primary">{fmt(c.revenue)}</div>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card-elevated p-5">
          <h2 className="mb-4 font-semibold">{t("Recent orders")}</h2>
          {overview.isLoading || !data ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : data.recentOrders.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("No recent orders")}</p>
          ) : (
            <div className="space-y-2">
              {data.recentOrders.map((o) => (
                <Link
                  key={o.id}
                  to="/dashboard/orders/$id"
                  params={{ id: o.id }}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5 transition hover:border-primary/40"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-primary">{o.orderNumber}</div>
                    <div className="truncate text-xs text-muted-foreground">{o.companyName}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{fmt(o.totalAmount, o.currency)}</div>
                    {o.statusCode && <StatusBadge status={o.statusCode} />}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {quick.length > 0 && (
        <>
          <h2 className="mt-8 mb-4 text-lg font-semibold">{t("Quick access")}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {quick.map((q) => (
              <Link key={q.to} to={q.to} className="card-elevated group p-5 transition hover:border-primary/40 hover:shadow-md">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary"><q.icon className="h-5 w-5" /></div>
                  <div>
                    <div className="font-semibold group-hover:text-primary">{t(q.label)}</div>
                    <div className="text-xs text-muted-foreground">{t(q.desc)}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function KpiCard({
  label, value, icon: Icon, hint, trend,
}: {
  label: string; value: string; icon: typeof Building2; hint?: string; trend?: number;
}) {
  return (
    <div className="card-elevated p-5">
      <div className="flex items-start justify-between">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary"><Icon className="h-4 w-4" /></div>
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight">{value}</div>
      {typeof trend === "number" ? (
        <div className={cn("mt-1 text-xs font-semibold", trend >= 0 ? "text-emerald-600" : "text-destructive")}>
          {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}% {t("vs yesterday")}
        </div>
      ) : hint ? (
        <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  );
}
