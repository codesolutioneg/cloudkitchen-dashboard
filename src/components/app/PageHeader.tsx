import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

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
    { label: "Dashboard", to: "/dashboard" },
    { label: title },
  ];

  return (
    <div className="sticky top-0 z-20 -mx-6 mb-6 border-b border-border bg-background/95 px-6 pb-4 pt-6 backdrop-blur">
      <nav className="mb-2 flex items-center gap-1 text-xs text-muted-foreground" aria-label="Breadcrumb">
        {crumbs.map((c, i) => (
          <span key={`${c.label}-${i}`} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3" />}
            {c.to && c.to !== pathname ? (
              <Link to={c.to} className="hover:text-foreground">{c.label}</Link>
            ) : (
              <span className="text-foreground">{c.label}</span>
            )}
          </span>
        ))}
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold leading-tight text-foreground">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
