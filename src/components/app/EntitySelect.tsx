import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

type Option = { value: string; label: string; hint?: string };

export function EntitySelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-10 w-full rounded-[10px] border border-border bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50",
        className,
      )}
    >
      <option value="">{placeholder ?? t("Search…")}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.hint ? `${o.label} · ${o.hint}` : o.label}
        </option>
      ))}
    </select>
  );
}
