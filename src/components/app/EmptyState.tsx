import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { t } from "@/lib/i18n";

export function EmptyState({
  icon,
  title = "Nothing here yet",
  description = "Data will appear once the API is connected.",
  action,
}: {
  icon?: ReactNode;
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
        {icon ?? <Inbox className="h-6 w-6" />}
      </div>
      <h3 className="text-base font-semibold text-foreground">{t(title)}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t(description)}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
