import { useMemo, useState, type ComponentType } from "react";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Building2, Users, Shield, Settings2, Boxes, UtensilsCrossed, ScrollText,
  Workflow, ShoppingBag, ChefHat, Truck, PackageCheck, ClipboardCheck,
  History, Bell, Cog, Database, Languages, LogOut, ChevronsLeft, ChevronsRight,
  ChevronDown, LayoutDashboard, Cloud, Search,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import type { NavigationNode } from "@/types/api";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { useLocale } from "@/hooks/useLocale";

// Static fallback used when /me/navigation isn't available. Super-admin sees all.
const STATIC_NAV: NavigationNode[] = [
  ["companies", "Companies", "/dashboard/companies", "Building2"],
  ["roles", "Roles & Permissions", "/dashboard/roles", "Shield"],
  ["users", "Dashboard Users", "/dashboard/users", "Users"],
  ["features", "Features & Modules", "/dashboard/features", "Settings2"],
  ["catalog", "Catalog (PIM)", "/dashboard/catalog", "Boxes"],
  ["menus", "Menus", "/dashboard/menus", "UtensilsCrossed"],
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
  ["settings", "Platform Settings", "/dashboard/settings", "Settings2"],
].map(([id, name, route, icon], i) => ({
  id, name, route, icon, sortOrder: i,
  permissions: { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true, canReject: true, canExport: true, canImport: true },
  children: [],
}));

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  Building2, Users, Shield, Settings2, Boxes, UtensilsCrossed, ScrollText,
  Workflow, ShoppingBag, ChefHat, Truck, PackageCheck, ClipboardCheck,
  History, Bell, Cog, Database, Languages, LayoutDashboard,
};

function iconFor(name: string | null | undefined) {
  if (name && ICONS[name]) return ICONS[name];
  return LayoutDashboard;
}

function NavItem({
  node, collapsed, depth = 0, currentPath,
}: {
  node: NavigationNode; collapsed: boolean; depth?: number; currentPath: string;
}) {
  const [open, setOpen] = useState(true);
  const Icon = iconFor(node.icon);
  const hasChildren = node.children && node.children.length > 0;
  const isActive =
    currentPath === node.route || (node.route !== "/" && currentPath.startsWith(node.route + "/"));
  const label = t(node.name);

  if (!node.permissions.canView) return null;

  const base = "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[15px] font-semibold transition-colors";
  const activeStyles = "bg-primary-soft text-primary";
  const inactiveStyles = "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";

  return (
    <div>
      {hasChildren && !collapsed ? (
        <button
          onClick={() => setOpen((v) => !v)}
          className={cn(base, isActive ? activeStyles : inactiveStyles)}
          style={{ paddingRight: `${12 + depth * 12}px` }}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-right truncate">{label}</span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", !open && "-rotate-90")} />
        </button>
      ) : (
        <Link
          to={node.route}
          className={cn(base, isActive ? activeStyles : inactiveStyles, collapsed && "justify-center px-2")}
          style={collapsed ? undefined : { paddingRight: `${12 + depth * 12}px` }}
          title={collapsed ? label : undefined}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="flex-1 truncate">{label}</span>}
        </Link>
      )}
      {hasChildren && open && !collapsed && (
        <div className="mt-1 space-y-1">
          {node.children.map((c) => (
            <NavItem key={c.id} node={c} collapsed={collapsed} depth={depth + 1} currentPath={currentPath} />
          ))}
        </div>
      )}
    </div>
  );
}

export function AppShell() {
  const { user, navigation, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [locale, setLocale] = useLocale();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const nav = useMemo(() => (navigation.length > 0 ? navigation : STATIC_NAV), [navigation]);

  return (
    <div className="flex min-h-screen w-full bg-background" dir={locale === "ar" ? "rtl" : "ltr"}>
      <aside
        className={cn(
          "sticky top-0 flex h-screen shrink-0 flex-col border-l bg-sidebar transition-all duration-200",
          collapsed ? "w-[72px]" : "w-[260px]",
        )}
        style={{ borderColor: "var(--sidebar-border)" }}
      >
        <div className="flex h-16 items-center gap-2.5 border-b px-4" style={{ borderColor: "var(--sidebar-border)" }}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Cloud className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-[15px] font-bold text-sidebar-foreground">{t("Cloud Kitchen")}</span>
              <span className="text-[11px] text-muted-foreground">{t("Super Admin")}</span>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {nav.map((n) => (
            <NavItem key={n.id} node={n} collapsed={collapsed} currentPath={pathname} />
          ))}
        </nav>

        <div className="border-t p-3" style={{ borderColor: "var(--sidebar-border)" }}>
          {!collapsed && user && (
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
                collapsed && "justify-center",
              )}
            >
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>{t("Sign out")}</span>}
            </button>
            <button
              onClick={() => setCollapsed((v) => !v)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
              aria-label={t("Toggle sidebar")}
            >
              {collapsed ? <ChevronsLeft className="h-4 w-4" /> : <ChevronsRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/95 px-6 backdrop-blur">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={t("Search…")}
              className="h-10 w-full rounded-[10px] border border-border bg-card pr-9 pl-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
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
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 pb-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
