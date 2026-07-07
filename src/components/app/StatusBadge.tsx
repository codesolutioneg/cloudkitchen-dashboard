import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Tone = "default" | "success" | "warning" | "danger" | "info" | "muted";

const TONE_MAP: Record<Tone, string> = {
  default: "bg-primary-soft text-primary border-primary/20",
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/25",
  danger: "bg-destructive/10 text-destructive border-destructive/20",
  info: "bg-info/10 text-info border-info/20",
  muted: "bg-muted text-muted-foreground border-border",
};

const STATUS_TO_TONE: Record<string, Tone> = {
  approved: "success",
  active: "success",
  verified: "success",
  delivered: "success",
  confirmed: "success",
  picked_up: "success",
  ready: "info",
  preparing: "info",
  out_for_delivery: "info",
  awaiting_pickup: "info",
  kitchen_accepted: "info",
  pending: "warning",
  under_review: "warning",
  pending_approval: "warning",
  resubmission_required: "warning",
  submitted: "muted",
  rejected: "danger",
  cancelled: "danger",
  failed: "danger",
};

export function StatusBadge({
  status,
  tone,
  children,
}: {
  status?: string;
  tone?: Tone;
  children?: ReactNode;
}) {
  const resolved = tone ?? (status ? STATUS_TO_TONE[status] ?? "default" : "default");
  const label = children ?? (status ? status.replaceAll("_", " ") : "");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize",
        TONE_MAP[resolved],
      )}
    >
      {label}
    </span>
  );
}
