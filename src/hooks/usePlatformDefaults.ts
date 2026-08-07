import { useQuery } from "@tanstack/react-query";
import { settingsApi } from "@/services/apiClient";
import { PLATFORM_CURRENCY } from "@/lib/systemOptions";

const FALLBACK_CURRENCY = PLATFORM_CURRENCY;
const FALLBACK_TIMEZONE = "Africa/Cairo";
const FALLBACK_LANGUAGE = "ar";

function readSetting(
  settings: Record<string, { value: unknown }> | undefined,
  key: string,
  fallback: string,
) {
  const raw = settings?.[key]?.value;
  if (raw == null) return fallback;
  // JSON scalar may arrive as string, or rarely as { value: "EGP" }
  if (typeof raw === "object" && raw !== null && "value" in (raw as object)) {
    const nested = (raw as { value: unknown }).value;
    if (nested != null) return String(nested);
  }
  const s = String(raw).replace(/^"|"$/g, "").trim();
  return s || fallback;
}

/** Platform defaults from Settings (business.default_*), with safe fallbacks. */
export function usePlatformDefaults() {
  const query = useQuery({
    queryKey: ["global-settings"],
    queryFn: settingsApi.getGlobal,
    staleTime: 30_000,
  });

  const settings = query.data?.settings;
  return {
    currency: readSetting(settings, "business.default_currency", FALLBACK_CURRENCY),
    timezone: readSetting(settings, "business.default_timezone", FALLBACK_TIMEZONE),
    language: readSetting(settings, "business.default_language", FALLBACK_LANGUAGE),
    isLoading: query.isLoading,
  };
}
