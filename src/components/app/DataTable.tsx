import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "./EmptyState";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  width?: string;
}

export function DataTable<T extends { id?: string | number }>({
  columns,
  rows,
  loading,
  onRowClick,
  emptyTitle,
  emptyDescription,
  rowKey,
}: {
  columns: Column<T>[];
  rows: T[] | undefined;
  loading?: boolean;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  rowKey?: (row: T, index: number) => string | number;
}) {
  if (loading) {
    return (
      <div className="card-elevated overflow-hidden">
        <div className="border-b border-border bg-muted/50 px-4 py-3">
          <div className="flex gap-4">
            {columns.map((c) => (
              <Skeleton key={c.key} className="h-4 flex-1" />
            ))}
          </div>
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-4 border-b border-border px-4 py-4 last:border-0">
            {columns.map((c) => <Skeleton key={c.key} className="h-4 flex-1" />)}
          </div>
        ))}
      </div>
    );
  }
  if (!rows || rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }
  return (
    <div className="card-elevated overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/60">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
                    c.className,
                  )}
                  style={c.width ? { width: c.width } : undefined}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={rowKey ? rowKey(row, i) : (row.id ?? i)}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  "border-t border-border transition-colors",
                  onRowClick && "cursor-pointer hover:bg-muted/40",
                )}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-4 py-3 text-foreground", c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TablePagination({
  page, pageSize, totalItems, onPageChange,
}: {
  page: number; pageSize: number; totalItems: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
      <span>
        Page {page} of {totalPages} · {totalItems} items
      </span>
      <div className="flex gap-2">
        <button
          className="rounded-md border border-border px-3 py-1.5 hover:bg-muted disabled:opacity-40"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >Previous</button>
        <button
          className="rounded-md border border-border px-3 py-1.5 hover:bg-muted disabled:opacity-40"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >Next</button>
      </div>
    </div>
  );
}
