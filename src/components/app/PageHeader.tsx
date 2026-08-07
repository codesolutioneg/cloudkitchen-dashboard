import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { t } from "@/lib/i18n";

export interface Crumb { label: string; to?: string }

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumbs?: Crumb[];
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const crumbs: Crumb[] = breadcrumbs ?? [
    { label: t("Dashboard"), to: "/dashboard" },
    { label: t(title) },
  ];

  return (
    <div className="sticky top-0 z-20 -mx-3 mb-4 border-b border-border bg-background/95 px-3 pb-3 pt-4 backdrop-blur sm:-mx-6 sm:mb-6 sm:px-6 sm:pb-4 sm:pt-6">
      <nav className="mb-2 flex items-center gap-1 overflow-x-auto text-xs text-muted-foreground" aria-label={t("Breadcrumb")}>
        {crumbs.map((c, i) => (
          <span key={`${c.label}-${i}`} className="flex shrink-0 items-center gap-1">
            {i > 0 && <ChevronLeft className="h-3 w-3" />}
            {c.to && c.to !== pathname ? (
              <Link to={c.to} className="hover:text-foreground">{t(c.label)}</Link>
            ) : (
              <span className="text-foreground">{t(c.label)}</span>
            )}
          </span>
        ))}
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-tight text-foreground sm:text-[28px]">{t(title)}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{t(description)}</p>}
        </div>
        {actions && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{actions}</div>}
      </div>
    </div>
  );
}
