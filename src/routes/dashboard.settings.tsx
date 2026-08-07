import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { EntitySelect } from "@/components/app/EntitySelect";
import { settingsApi } from "@/services/apiClient";
import { ChevronDown, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { CURRENCIES, LANGUAGES, TIMEZONES, optionsFrom } from "@/lib/systemOptions";
import { cn } from "@/lib/utils";
import { applyPrimaryColor } from "@/components/app/ThemeFromSettings";

export const Route = createFileRoute("/dashboard/settings")({ component: SettingsPage });

function SettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["global-settings"], queryFn: settingsApi.getGlobal });
  const [currency, setCurrency] = useState("EGP");
  const [timezone, setTimezone] = useState("Africa/Cairo");
  const [language, setLanguage] = useState("ar");
  const [primaryColor, setPrimaryColor] = useState("#2563eb");
  const [vatRate, setVatRate] = useState("0.15");
  const [saving, setSaving] = useState(false);
  const [openSection, setOpenSection] = useState<string>("business");

  useEffect(() => {
    if (!data?.settings) return;
    const s = data.settings;
    const cur = s["business.default_currency"]?.value;
    const tz = s["business.default_timezone"]?.value;
    const lang = s["business.default_language"]?.value;
    const color = s["theme.primary_color"]?.value;
    const vat = s["ordering.default_vat_rate"]?.value;
    if (cur != null) setCurrency("EGP");
    if (tz != null) setTimezone(String(tz));
    if (lang != null) setLanguage(String(lang));
    if (color != null) setPrimaryColor(String(color));
    if (vat != null) setVatRate(String(vat));
  }, [data]);

  async function saveBusiness() {
    setSaving(true);
    try {
      await settingsApi.updateGlobal({
        "business.default_currency": "EGP",
        "business.default_timezone": timezone,
        "business.default_language": language,
      });
      setCurrency("EGP");
      toast.success(t("Saved"));
      await qc.invalidateQueries({ queryKey: ["global-settings"] });
      await qc.invalidateQueries({ queryKey: ["analytics-overview"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function saveOrdering() {
    setSaving(true);
    try {
      const vat = Number(vatRate);
      await settingsApi.updateGlobal({
        "theme.primary_color": primaryColor,
        "ordering.default_vat_rate": Number.isFinite(vat) ? vat : 0.15,
      });
      applyPrimaryColor(primaryColor);
      toast.success(t("Saved"));
      await qc.invalidateQueries({ queryKey: ["global-settings"] });
      await qc.invalidateQueries({ queryKey: ["analytics-overview"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title={t("Settings")}
        description={t("Global configuration applied across all companies.")}
      />
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="mx-auto max-w-3xl space-y-3">
          <AccordionSection
            id="business"
            title={t("Business defaults")}
            subtitle={t("Currency, timezone, and language used across the platform.")}
            open={openSection === "business"}
            onToggle={() => setOpenSection((v) => (v === "business" ? "" : "business"))}
          >
            <Field label={t("Default currency")}>
              <EntitySelect
                value={currency}
                onChange={setCurrency}
                options={optionsFrom(CURRENCIES, t)}
                placeholder={t("Currency")}
                disabled
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                {t("Platform currency is EGP only.")}
              </p>
            </Field>
            <Field label={t("Default timezone")}>
              <EntitySelect
                value={timezone}
                onChange={setTimezone}
                options={optionsFrom(TIMEZONES, t)}
                placeholder={t("Timezone")}
              />
            </Field>
            <Field label={t("Default language")}>
              <EntitySelect
                value={language}
                onChange={setLanguage}
                options={optionsFrom(LANGUAGES, t)}
                placeholder={t("Language")}
              />
            </Field>
            <SaveRow saving={saving} onClick={() => void saveBusiness()} />
          </AccordionSection>

          <AccordionSection
            id="ordering"
            title={t("Ordering & theme")}
            subtitle={t("VAT default and brand color.")}
            open={openSection === "ordering"}
            onToggle={() => setOpenSection((v) => (v === "ordering" ? "" : "ordering"))}
          >
            <Field label={t("Default VAT rate")}>
              <input
                value={vatRate}
                onChange={(e) => setVatRate(e.target.value)}
                className="h-10 w-full rounded-[10px] border border-border bg-card px-3 text-sm"
                placeholder="0.15"
              />
            </Field>
            <Field label={t("Primary color")}>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => {
                    setPrimaryColor(e.target.value);
                    applyPrimaryColor(e.target.value);
                  }}
                  className="h-10 w-14 cursor-pointer rounded border border-border bg-card"
                />
                <input
                  value={primaryColor}
                  onChange={(e) => {
                    setPrimaryColor(e.target.value);
                    if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) applyPrimaryColor(e.target.value);
                  }}
                  className="h-10 flex-1 rounded-[10px] border border-border bg-card px-3 font-mono text-sm"
                />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {t("Applies instantly across the dashboard. Click Save to keep it.")}
              </p>
            </Field>
            <SaveRow saving={saving} onClick={() => void saveOrdering()} />
          </AccordionSection>
        </div>
      )}
    </>
  );
}

function AccordionSection({
  id,
  title,
  subtitle,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  subtitle: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm" data-section={id}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-5 py-4 text-start hover:bg-muted/40"
      >
        <div className="min-w-0 flex-1">
          <div className="text-base font-bold text-foreground">{title}</div>
          <div className="mt-0.5 text-sm text-muted-foreground">{subtitle}</div>
        </div>
        <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="space-y-4 border-t border-border px-5 py-5">{children}</div>}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-foreground">{label}</label>
      {children}
    </div>
  );
}

function SaveRow({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <div className="flex justify-end pt-1">
      <button
        type="button"
        disabled={saving}
        onClick={onClick}
        className="flex h-10 items-center gap-2 rounded-[10px] bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {t("Save")}
      </button>
    </div>
  );
}
