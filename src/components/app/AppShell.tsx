import { useMemo, useState, type ComponentType } from "react";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Building2, Users, Shield, Settings2, Boxes, UtensilsCrossed, ScrollText,
  Workflow, ShoppingBag, ChefHat, Truck, PackageCheck, ClipboardCheck,
  History, Bell, Cog, Database, Languages, LogOut, ChevronsLeft, ChevronsRight,
  ChevronDown, LayoutDashboard, Search, Menu, X, Salad,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import type { NavigationNode } from "@/types/api";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { useLocale } from "@/hooks/useLocale";
import { useIsMobile } from "@/hooks/use-mobile";
import { AssistantWidget } from "@/components/app/AssistantWidget";

const STATIC_NAV: NavigationNode[] = [
  ["dashboard", "Dashboard", "/dashboard", "LayoutDashboard"],
  ["companies", "Companies", "/dashboard/companies", "Building2"],
  ["roles", "Roles & Permissions", "/dashboard/roles", "Shield"],
  ["users", "Dashboard Users", "/dashboard/users", "Users"],
  ["features", "Features & Modules", "/dashboard/features", "Settings2"],
  ["catalog", "Catalog (PIM)", "/dashboard/catalog", "Boxes"],
  ["menus", "Menus", "/dashboard/menus", "UtensilsCrossed"],
  ["meal-plans", "Meal Plans", "/dashboard/meal-plans", "Salad"],
  ["rules", "Business Rules", "/dashboard/rules", "ScrollText"],
  ["workflows", "Workflows", "/dashboard/workflows", "Workflow"],
  ["orders", "Orders", "/dashboard/orders", "ShoppingBag"],
  ["kitchen", "Kitchen", "/dashboard/kitchen", "ChefHat"],
  ["operations", "Operations Desk", "/dashboard/operations", "PackageCheck"],
  ["delivery", "Delivery", "/dashboard/delivery", "Truck"],
  ["approval-workflows", "Approval Workflows", "/dashboard/approval-workflows", "ClipboardCheck"],
  ["audit-logs", "Audit Logs", "/dashboard/audit-logs", "History"],
  ["notifications", "Notifications", "/dashboard/notifications", "Bell"],
  ["jobs", "Background Jobs", "/dashboard/jobs", "Cog"],
  ["integrations", "Integrations", "/dashboard/integrations", "Database"],
  ["localization", "Localization", "/dashboard/localization", "Languages"],
  ["settings", "Settings", "/dashboard/settings", "Settings2"],
].map(([id, name, route, icon], i) => ({
  id, name, route, icon, sortOrder: i,
  permissions: { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true, canReject: true, canExport: true, canImport: true },
  children: [],
}));

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  Building2, Users, Shield, Settings2, Boxes, UtensilsCrossed, ScrollText,
  Workflow, ShoppingBag, ChefHat, Truck, PackageCheck, ClipboardCheck,
  History, Bell, Cog, Database, Languages, LayoutDashboard, Salad,
};

function iconFor(name: string | null | undefined) {
  if (name && ICONS[name]) return ICONS[name];
  return LayoutDashboard;
}

function NavItem({
  node, collapsed, depth = 0, currentPath, onNavigate,
}: {
  node: NavigationNode; collapsed: boolean; depth?: number; currentPath: string; onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(true);
  const Icon = iconFor(node.icon);
  const hasChildren = node.children && node.children.length > 0;
  const isExact = currentPath === node.route;
  const isNested =
    node.route !== "/" &&
    node.route !== "/dashboard" &&
    currentPath.startsWith(node.route + "/");
  const isActive = isExact || isNested;
  const label = t(node.name);

  if (!node.permissions.canView) return null;

  const base = "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-semibold transition-colors";
  const activeStyles = "bg-primary-soft text-primary";
  const inactiveStyles = "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";

  return (
    <div>
      {hasChildren && !collapsed ? (
        <button
          onClick={() => setOpen((v) => !v)}
          className={cn(base, isActive ? activeStyles : inactiveStyles)}
          style={{ paddingInlineEnd: `${12 + depth * 12}px` }}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate text-start">{label}</span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", !open && "-rotate-90")} />
        </button>
      ) : (
        <Link
          to={node.route}
          onClick={onNavigate}
          className={cn(base, isActive ? activeStyles : inactiveStyles, collapsed && "justify-center px-2")}
          style={collapsed ? undefined : { paddingInlineEnd: `${12 + depth * 12}px` }}
          title={collapsed ? label : undefined}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="flex-1 truncate">{label}</span>}
        </Link>
      )}
      {hasChildren && open && !collapsed && (
        <div className="mt-1 space-y-1">
          {node.children.map((c) => (
            <NavItem key={c.id} node={c} collapsed={collapsed} depth={depth + 1} currentPath={currentPath} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

export function AppShell() {
  const { user, navigation, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [locale, setLocale] = useLocale();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isMobile = useIsMobile();

  const nav = useMemo(() => (navigation.length > 0 ? navigation : STATIC_NAV), [navigation]);
  const isDeliveryOnly =
    !!user?.roles?.some((r) => r.name === "Delivery") &&
    !user?.roles?.some((r) => r.name === "Super Admin") &&
    nav.every((n) => n.route === "/dashboard/delivery" || n.route === "/dashboard");

  return (
    <div className="flex min-h-screen w-full bg-background" dir={locale === "ar" ? "rtl" : "ltr"}>
      {/* Mobile overlay */}
      {isMobile && mobileOpen && (
        <button
          type="button"
          aria-label={t("Close")}
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "z-50 flex shrink-0 flex-col border-s bg-sidebar transition-transform duration-200",
          isMobile
            ? cn(
                "fixed inset-y-0 start-0 w-[min(86vw,280px)] shadow-xl",
                mobileOpen ? "translate-x-0" : "ltr:-translate-x-full rtl:translate-x-full",
              )
            : cn("sticky top-0 h-screen", collapsed ? "w-[72px]" : "w-[260px]"),
        )}
        style={{ borderColor: "var(--sidebar-border)" }}
      >
        <div className="flex h-14 items-center gap-2.5 border-b px-4 sm:h-16" style={{ borderColor: "var(--sidebar-border)" }}>
          <img src="/logo.png" alt={t("Cloud Kitchen")} className="h-9 w-9 shrink-0 rounded-xl object-cover" />
          {(isMobile || !collapsed) && (
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-[15px] font-bold text-sidebar-foreground">{t("Cloud Kitchen")}</span>
              <span className="truncate text-[11px] text-muted-foreground">
                {user?.roles?.[0]?.name ? t(user.roles[0].name) : t("Dashboard")}
              </span>
            </div>
          )}
          {isMobile && (
            <button type="button" onClick={() => setMobileOpen(false)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label={t("Close")}>
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {nav.map((n) => (
            <NavItem
              key={n.id}
              node={n}
              collapsed={!isMobile && collapsed}
              currentPath={pathname}
              onNavigate={() => setMobileOpen(false)}
            />
          ))}
        </nav>

        <div className="border-t p-3" style={{ borderColor: "var(--sidebar-border)" }}>
          {(isMobile || !collapsed) && user && (
            <div className="mb-2 rounded-lg bg-muted/60 px-3 py-2">
              <div className="truncate text-sm font-semibold text-foreground">{user.fullName}</div>
              <div className="truncate text-xs text-muted-foreground">{user.email}</div>
            </div>
          )}
          <div className="flex items-center gap-1">
            <button
              onClick={async () => { await logout(); navigate({ to: "/login" }); }}
              className={cn(
                "flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-destructive",
                !isMobile && collapsed && "justify-center",
              )}
            >
              <LogOut className="h-4 w-4" />
              {(isMobile || !collapsed) && <span>{t("Sign out")}</span>}
            </button>
            {!isMobile && (
              <button
                onClick={() => setCollapsed((v) => !v)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                aria-label={t("Toggle sidebar")}
              >
                {collapsed ? <ChevronsLeft className="h-4 w-4" /> : <ChevronsRight className="h-4 w-4" />}
              </button>
            )}
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur sm:h-16 sm:gap-4 sm:px-6">
          {isMobile && (
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg border border-border bg-card p-2 text-foreground"
              aria-label={t("Menu")}
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          <div className="relative hidden flex-1 max-w-md sm:block">
            <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={t("Search…")}
              className="h-10 w-full rounded-[10px] border border-border bg-card pe-9 ps-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="ms-auto flex items-center gap-2">
            <button className="relative rounded-lg border border-border bg-card p-2 text-muted-foreground hover:text-foreground">
              <Bell className="h-4 w-4" />
            </button>
            <div className="flex items-center rounded-[10px] border border-border bg-card p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setLocale("ar")}
                className={cn(
                  "rounded-md px-2.5 py-1.5 transition-colors",
                  locale === "ar" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
                aria-label={t("Arabic")}
              >
                ع
              </button>
              <button
                type="button"
                onClick={() => setLocale("en")}
                className={cn(
                  "rounded-md px-2.5 py-1.5 transition-colors",
                  locale === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
                aria-label={t("English")}
              >
                EN
              </button>
            </div>
          </div>
        </header>

        <main className={cn(
          "mx-auto w-full flex-1 px-3 pb-24 pt-1 sm:max-w-[1400px] sm:px-6 sm:pb-10",
          isDeliveryOnly && "pb-28",
        )}>
          <Outlet />
        </main>

        {/* Mobile bottom actions for delivery drivers */}
        {isMobile && isDeliveryOnly && (
          <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-3 py-2 backdrop-blur safe-bottom">
            <div className="mx-auto flex max-w-lg gap-2">
              <Link
                to="/dashboard"
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-xs font-semibold",
                  pathname === "/dashboard" ? "bg-primary-soft text-primary" : "text-muted-foreground",
                )}
              >
                <LayoutDashboard className="h-5 w-5" />
                {t("Dashboard")}
              </Link>
              <Link
                to="/dashboard/delivery"
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-xs font-semibold",
                  pathname.startsWith("/dashboard/delivery") ? "bg-primary-soft text-primary" : "text-muted-foreground",
                )}
              >
                <Truck className="h-5 w-5" />
                {t("Delivery")}
              </Link>
            </div>
          </nav>
        )}
      </div>
      {user && <AssistantWidget />}
    </div>
  );
}
