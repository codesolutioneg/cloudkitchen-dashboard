import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { settingsApi } from "@/services/apiClient";
import { useAuth } from "@/lib/auth";

const DEFAULT_PRIMARY = "#6366F1";

function readPrimary(settings: Record<string, { value: unknown }> | undefined): string {
  const raw = settings?.["theme.primary_color"]?.value;
  if (raw == null) return DEFAULT_PRIMARY;
  const s = String(raw).trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s;
  if (/^#[0-9A-Fa-f]{3}$/.test(s)) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  }
  return DEFAULT_PRIMARY;
}

/** Push Settings → theme.primary_color onto CSS variables used by the dashboard. */
export function applyPrimaryColor(hex: string) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const color = /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : DEFAULT_PRIMARY;
  root.style.setProperty("--primary", color);
  root.style.setProperty("--ring", color);
  root.style.setProperty("--sidebar-primary", color);
  root.style.setProperty("--sidebar-ring", color);
  // Soft tint for chips / hover backgrounds
  root.style.setProperty("--primary-soft", `color-mix(in srgb, ${color} 14%, white)`);
  root.style.setProperty("--accent", `color-mix(in srgb, ${color} 14%, white)`);
  root.style.setProperty("--sidebar-accent", `color-mix(in srgb, ${color} 14%, white)`);
  root.style.setProperty("--accent-foreground", color);
  root.style.setProperty("--sidebar-accent-foreground", color);
}

export function ThemeFromSettings() {
  const { isAuthenticated, isReady } = useAuth();
  const { data } = useQuery({
    queryKey: ["global-settings"],
    queryFn: settingsApi.getGlobal,
    enabled: isReady && isAuthenticated,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!data?.settings) return;
    applyPrimaryColor(readPrimary(data.settings));
  }, [data]);

  return null;
}
