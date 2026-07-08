import { useSyncExternalStore } from "react";
import { getLocale, setLocale, subscribeLocale, type Locale } from "@/lib/i18n";

export function useLocale(): [Locale, (locale: Locale) => void] {
  const locale = useSyncExternalStore(subscribeLocale, getLocale, () => "ar" as Locale);
  return [locale, setLocale];
}
