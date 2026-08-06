import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { catalogApi, catalogExtApi, localizationApi, nutritionApi } from "@/services/apiClient";
import type { MealComponentType } from "@/types/api";
import { ArrowLeft, Loader2, Plus, Trash2, Save, Upload } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { normalizePublicAssetUrl } from "@/lib/assetUrl";
import { EntitySelect } from "@/components/app/EntitySelect";

export const Route = createFileRoute("/dashboard/catalog/products/$id")({ component: ProductDetail });

function ProductDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const p = useQuery({ queryKey: ["product", id], queryFn: () => catalogApi.getProduct(id) });
  const [form, setForm] = useState({ name: "", description: "", basePrice: "0", currency: "USD", isActive: true, prepTimeMins: 25 });
  useEffect(() => {
    if (p.data) setForm({
      name: p.data.name,
      description: p.data.description ?? "",
      basePrice: p.data.basePrice,
      currency: p.data.currency,
      isActive: p.data.isActive,
      prepTimeMins: p.data.prepTimeMins ?? 25,
    });
  }, [p.data]);

  async function save() {
    try { await catalogApi.updateProduct(id, form); toast.success("Product saved"); qc.invalidateQueries({ queryKey: ["product", id] }); }
    catch (e) { toast.error((e as Error).message); }
  }

  if (p.isLoading) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!p.data) return <div className="py-24 text-center">Product not found</div>;

  return (
    <>
      <PageHeader
        title={p.data.name}
        description={`SKU ${p.data.sku ?? "—"} · ${p.data.basePrice} ${p.data.currency}`}
        breadcrumbs={[{ label: t("Dashboard"), to: "/dashboard" }, { label: t("Catalog"), to: "/dashboard/catalog" }, { label: p.data.name }]}
        actions={
          <div className="flex items-center gap-3">
            {p.data.imageUrl && (
              <img src={normalizePublicAssetUrl(p.data.imageUrl) ?? undefined} alt={p.data.name} className="h-12 w-12 rounded-lg border border-border object-cover" />
            )}
            <Link to="/dashboard/catalog" className="flex items-center gap-2 rounded-[10px] border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"><ArrowLeft className="h-4 w-4" /> {t("Back")}</Link>
          </div>
        }
      />
      <Tabs defaultValue="general">
        <TabsList className="mb-4">
          <TabsTrigger value="general">{t("General")}</TabsTrigger>
          <TabsTrigger value="image">{t("Image")}</TabsTrigger>
          <TabsTrigger value="translations">{t("Translations")}</TabsTrigger>
          <TabsTrigger value="variants">{t("Variants")}</TabsTrigger>
          <TabsTrigger value="options">{t("Options")}</TabsTrigger>
          <TabsTrigger value="availability">{t("Availability")}</TabsTrigger>
          <TabsTrigger value="tags">{t("Tags")}</TabsTrigger>
          <TabsTrigger value="nutrition">{t("Nutrition")}</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <div className="card-elevated max-w-2xl space-y-3 p-6">
            <div><label className="mb-1 block text-sm font-semibold">Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10 w-full rounded-[10px] border border-border bg-card px-3 text-sm" /></div>
            <div><label className="mb-1 block text-sm font-semibold">Description</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="min-h-[100px] w-full rounded-[10px] border border-border bg-card p-3 text-sm" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="mb-1 block text-sm font-semibold">Base price</label><input value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} className="h-10 w-full rounded-[10px] border border-border bg-card px-3 text-sm" /></div>
              <div><label className="mb-1 block text-sm font-semibold">Currency</label><input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="h-10 w-full rounded-[10px] border border-border bg-card px-3 text-sm" /></div>
              <div><label className="mb-1 block text-sm font-semibold">Prep time (mins)</label><input type="number" value={form.prepTimeMins} onChange={(e) => setForm({ ...form, prepTimeMins: +e.target.value })} className="h-10 w-full rounded-[10px] border border-border bg-card px-3 text-sm" /></div>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active</label>
            <button onClick={save} className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Save className="h-4 w-4" /> {t("Save")}</button>
          </div>
        </TabsContent>

        <TabsContent value="image"><ImageTab productId={id} imageUrl={p.data.imageUrl} /></TabsContent>

        <TabsContent value="translations"><TranslationsTab productId={id} /></TabsContent>
        <TabsContent value="variants"><VariantsTab productId={id} /></TabsContent>
        <TabsContent value="options"><OptionsTab productId={id} /></TabsContent>
        <TabsContent value="availability"><AvailabilityTab productId={id} /></TabsContent>
        <TabsContent value="tags"><TagsTab productId={id} /></TabsContent>
        <TabsContent value="nutrition"><NutritionTab productId={id} /></TabsContent>
      </Tabs>
    </>
  );
}

function ImageTab({ productId, imageUrl }: { productId: string; imageUrl?: string | null }) {
  const qc = useQueryClient();
  const media = useQuery({ queryKey: ["product-media", productId], queryFn: () => catalogExtApi.listMedia(productId) });
  const displayUrl = normalizePublicAssetUrl(imageUrl) ?? normalizePublicAssetUrl(media.data?.find((m) => m.isPrimary)?.url);
  const [urlInput, setUrlInput] = useState(displayUrl ?? "");

  async function upload(f: File) {
    try {
      const res = await catalogExtApi.uploadImage(productId, f);
      const publicUrl = normalizePublicAssetUrl(res.imageUrl) ?? res.imageUrl;
      setUrlInput(publicUrl);
      toast.success(t("Image uploaded"));
      qc.invalidateQueries({ queryKey: ["product-media", productId] });
      qc.invalidateQueries({ queryKey: ["product", productId] });
    } catch (e) { toast.error((e as Error).message); }
  }

  async function saveUrl() {
    try {
      await catalogExtApi.setImageUrl(productId, urlInput.trim() || null);
      toast.success(t("Image URL saved"));
      qc.invalidateQueries({ queryKey: ["product-media", productId] });
      qc.invalidateQueries({ queryKey: ["product", productId] });
    } catch (e) { toast.error((e as Error).message); }
  }

  async function remove(mediaId: string) {
    try {
      await catalogExtApi.deleteMedia(productId, mediaId);
      toast.success(t("Removed"));
      qc.invalidateQueries({ queryKey: ["product-media", productId] });
      qc.invalidateQueries({ queryKey: ["product", productId] });
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="card-elevated max-w-xl space-y-4 p-6">
      {displayUrl ? (
        <div className="relative">
          <img src={displayUrl} alt="Product" className="max-h-64 w-full rounded-xl border border-border object-contain bg-muted/30" />
        </div>
      ) : (
        <EmptyState title={t("No image")} description={t("Upload a product photo like Dishflow.")} />
      )}
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-dashed border-border px-4 py-6 text-sm font-semibold hover:bg-muted/50">
        <Upload className="h-4 w-4" /> {t("Upload image")}
        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </label>
      <div className="space-y-2">
        <label className="block text-sm font-semibold">{t("Or paste image URL")}</label>
        <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://..." className="h-10 w-full rounded-[10px] border border-border bg-card px-3 text-sm" />
        <button onClick={saveUrl} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{t("Save URL")}</button>
      </div>
      {media.data && media.data.length > 0 && (
        <ul className="divide-y divide-border text-sm">
          {media.data.map((m) => {
            const url = normalizePublicAssetUrl(m.url) ?? m.url;
            return (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                <a href={url} target="_blank" rel="noreferrer" className="truncate text-primary hover:underline">{url}</a>
                <button onClick={() => remove(m.id)} className="shrink-0 text-destructive hover:underline"><Trash2 className="h-4 w-4" /></button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TranslationsTab({ productId }: { productId: string }) {
  const languages = useQuery({ queryKey: ["languages"], queryFn: localizationApi.listLanguages });
  const [lang, setLang] = useState("ar");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  async function save() {
    try {
      await catalogApi.updateProductTranslation(productId, lang, { name, description: desc || undefined });
      toast.success(t("Saved"));
    } catch (e) { toast.error((e as Error).message); }
  }
  const langOptions = (languages.data ?? []).map((l) => ({ value: l.code, label: l.name, hint: l.code.toUpperCase() }));
  return (
    <div className="card-elevated max-w-xl space-y-3 p-6">
      <div>
        <label className="mb-1 block text-sm font-semibold">{t("Language")}</label>
        {langOptions.length > 0 ? (
          <EntitySelect value={lang} onChange={setLang} options={langOptions} placeholder={t("Select language…")} />
        ) : (
          <input value={lang} onChange={(e) => setLang(e.target.value)} className="h-10 w-32 rounded-[10px] border border-border bg-card px-3 text-sm" placeholder="ar" />
        )}
      </div>
      <div><label className="mb-1 block text-sm font-semibold">{t("Name")}</label><input value={name} onChange={(e) => setName(e.target.value)} className="h-10 w-full rounded-[10px] border border-border bg-card px-3 text-sm" dir={lang === "ar" ? "rtl" : "ltr"} /></div>
      <div><label className="mb-1 block text-sm font-semibold">{t("Description")}</label><textarea value={desc} onChange={(e) => setDesc(e.target.value)} className="min-h-[80px] w-full rounded-[10px] border border-border bg-card p-3 text-sm" dir={lang === "ar" ? "rtl" : "ltr"} /></div>
      <button onClick={save} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{t("Save translation")}</button>
    </div>
  );
}

function VariantsTab({ productId }: { productId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["variants", productId], queryFn: () => catalogExtApi.listVariants(productId).catch(() => [] as never[]) });
  const [name, setName] = useState(""); const [sku, setSku] = useState(""); const [delta, setDelta] = useState("0");
  async function add() {
    if (!name.trim()) return;
    try { await catalogExtApi.createVariant(productId, { name, sku: sku || null, priceDelta: delta, isActive: true }); toast.success("Variant added"); setName(""); setSku(""); setDelta("0"); qc.invalidateQueries({ queryKey: ["variants", productId] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  return (
    <div className="space-y-3">
      <div className="card-elevated flex flex-wrap gap-2 p-4">
        <input placeholder={t("Variant name")} value={name} onChange={(e) => setName(e.target.value)} className="h-9 flex-1 min-w-[140px] rounded-md border border-border bg-card px-2 text-sm" />
        <input placeholder={t("SKU")} value={sku} onChange={(e) => setSku(e.target.value)} className="h-9 w-32 rounded-md border border-border bg-card px-2 text-sm" />
        <input placeholder={t("Price delta")} value={delta} onChange={(e) => setDelta(e.target.value)} className="h-9 w-28 rounded-md border border-border bg-card px-2 text-sm" />
        <button onClick={add} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> {t("Add")}</button>
      </div>
      {isLoading ? <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" /> :
        !data || data.length === 0 ? <EmptyState title={t("No variants")} /> : (
          <div className="card-elevated divide-y divide-border">
            {data.map((v) => (
              <div key={v.id} className="flex items-center justify-between p-3">
                <div><div className="font-semibold">{v.name}</div><div className="text-xs text-muted-foreground">{v.sku ?? "—"} · Δ {v.priceDelta ?? "0"}</div></div>
                <StatusBadge tone={v.isActive ? "success" : "muted"}>{v.isActive ? "Active" : "Inactive"}</StatusBadge>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

function OptionsTab({ productId }: { productId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["option-groups", productId], queryFn: () => catalogExtApi.listOptionGroups(productId).catch(() => [] as never[]) });
  const [name, setName] = useState(""); const [min, setMin] = useState(0); const [max, setMax] = useState(1);
  async function add() {
    if (!name.trim()) return;
    try { await catalogExtApi.createOptionGroup(productId, { name, minSelect: min, maxSelect: max }); toast.success("Group added"); setName(""); qc.invalidateQueries({ queryKey: ["option-groups", productId] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  return (
    <div className="space-y-3">
      <div className="card-elevated flex flex-wrap gap-2 p-4">
        <input placeholder={t("Group name (e.g. Sauce)")} value={name} onChange={(e) => setName(e.target.value)} className="h-9 flex-1 min-w-[140px] rounded-md border border-border bg-card px-2 text-sm" />
        <input type="number" placeholder={t("min")} value={min} onChange={(e) => setMin(+e.target.value)} className="h-9 w-20 rounded-md border border-border bg-card px-2 text-sm" />
        <input type="number" placeholder={t("max")} value={max} onChange={(e) => setMax(+e.target.value)} className="h-9 w-20 rounded-md border border-border bg-card px-2 text-sm" />
        <button onClick={add} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> Add group</button>
      </div>
      {isLoading ? <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" /> :
        !data || data.length === 0 ? <EmptyState title={t("No option groups")} /> : (
          <div className="card-elevated divide-y divide-border">
            {data.map((g) => (
              <div key={g.id} className="p-3"><div className="font-semibold">{g.name}</div><div className="text-xs text-muted-foreground">Select {g.minSelect}-{g.maxSelect}</div></div>
            ))}
          </div>
        )}
    </div>
  );
}

function AvailabilityTab({ productId }: { productId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["availability", productId], queryFn: () => catalogExtApi.listAvailability(productId).catch(() => [] as never[]) });
  const [day, setDay] = useState<number | null>(null); const [start, setStart] = useState(""); const [end, setEnd] = useState("");
  async function add() {
    try { await catalogExtApi.createAvailability(productId, { dayOfWeek: day, startTime: start || null, endTime: end || null }); toast.success("Added"); qc.invalidateQueries({ queryKey: ["availability", productId] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function del(availabilityId: string) {
    try { await catalogExtApi.deleteAvailability(productId, availabilityId); toast.success("Removed"); qc.invalidateQueries({ queryKey: ["availability", productId] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  return (
    <div className="space-y-3">
      <div className="card-elevated flex flex-wrap gap-2 p-4">
        <select value={day ?? ""} onChange={(e) => setDay(e.target.value ? +e.target.value : null)} className="h-9 rounded-md border border-border bg-card px-2 text-sm">
          <option value="">Any day</option>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => <option key={i} value={i}>{d}</option>)}
        </select>
        <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="h-9 rounded-md border border-border bg-card px-2 text-sm" />
        <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="h-9 rounded-md border border-border bg-card px-2 text-sm" />
        <button onClick={add} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> {t("Add")}</button>
      </div>
      {isLoading ? <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" /> :
        !data || data.length === 0 ? <EmptyState title={t("Always available")} /> : (
          <div className="card-elevated divide-y divide-border">
            {data.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-3 text-sm">
                <span>Day {a.dayOfWeek ?? "any"} · {a.startTime ?? "—"} → {a.endTime ?? "—"}</span>
                <button onClick={() => del(a.id)} className="text-destructive hover:underline"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

function TagsTab({ productId }: { productId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["tags", productId], queryFn: () => catalogExtApi.listTags(productId).catch(() => [] as never[]) });
  const [tag, setTag] = useState("");
  async function add() {
    if (!tag.trim()) return;
    try { await catalogExtApi.addTag(productId, tag); toast.success("Tagged"); setTag(""); qc.invalidateQueries({ queryKey: ["tags", productId] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function remove(tagId: string) {
    try { await catalogExtApi.removeTag(productId, tagId); toast.success("Removed"); qc.invalidateQueries({ queryKey: ["tags", productId] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  return (
    <div className="space-y-3">
      <div className="card-elevated flex gap-2 p-4">
        <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder={t("Add tag…")} className="h-9 flex-1 rounded-md border border-border bg-card px-2 text-sm" />
        <button onClick={add} className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">{t("Add")}</button>
      </div>
      {isLoading ? <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" /> :
        !data || data.length === 0 ? <EmptyState title={t("No tags")} /> : (
          <div className="flex flex-wrap gap-2">
            {data.map((t) => (
              <span key={t.id} className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
                {t.tag}
                <button onClick={() => remove(t.id)} className="hover:text-destructive">×</button>
              </span>
            ))}
          </div>
        )}
    </div>
  );
}

const NUTRITION_COMPONENTS: MealComponentType[] = [
  "protein",
  "carb",
  "vegetable",
  "salad",
  "soup",
  "side",
  "drink",
  "dessert",
  "other",
];

const BLANK_NUTRITION = {
  componentType: "other" as MealComponentType,
  servingSizeG: 0,
  caloriesKcal: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  fiberG: 0,
  sodiumMg: 0,
  allergens: "",
  ingredients: "",
};

/** Per-serving macros. The budget meal planner only considers products that have this. */
function NutritionTab({ productId }: { productId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["nutrition", productId],
    queryFn: () => nutritionApi.get(productId).catch(() => null),
  });
  const [form, setForm] = useState(BLANK_NUTRITION);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setForm({
      componentType: data.componentType,
      servingSizeG: data.servingSizeG ?? 0,
      caloriesKcal: Number(data.caloriesKcal),
      proteinG: Number(data.proteinG),
      carbsG: Number(data.carbsG),
      fatG: Number(data.fatG),
      fiberG: data.fiberG ? Number(data.fiberG) : 0,
      sodiumMg: data.sodiumMg ? Number(data.sodiumMg) : 0,
      allergens: data.allergens.join(", "),
      ingredients: data.ingredients ?? "",
    });
  }, [data]);

  async function save() {
    setSaving(true);
    try {
      await nutritionApi.upsert(productId, {
        componentType: form.componentType,
        servingSizeG: form.servingSizeG || null,
        caloriesKcal: form.caloriesKcal,
        proteinG: form.proteinG,
        carbsG: form.carbsG,
        fatG: form.fatG,
        fiberG: form.fiberG || null,
        sodiumMg: form.sodiumMg || null,
        allergens: form.allergens.split(",").map((a) => a.trim()).filter(Boolean),
        ingredients: form.ingredients || null,
      });
      toast.success(t("Nutrition saved"));
      qc.invalidateQueries({ queryKey: ["nutrition", productId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm(t("Remove nutrition data?"))) return;
    try {
      await nutritionApi.remove(productId);
      setForm(BLANK_NUTRITION);
      toast.success(t("Removed"));
      qc.invalidateQueries({ queryKey: ["nutrition", productId] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (isLoading) return <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />;

  const num = (key: keyof typeof form, label: string) => (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <input
        type="number"
        min={0}
        value={form[key] as number}
        onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
        className="h-10 w-full rounded-[10px] border border-border bg-card px-3 text-sm"
      />
    </label>
  );

  return (
    <div className="space-y-4">
      {!data && (
        <p className="text-sm text-muted-foreground">
          {t("This product has no nutrition data yet, so the meal planner will skip it.")}
        </p>
      )}
      <div className="card-elevated grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground">{t("Meal component")}</span>
          <select
            value={form.componentType}
            onChange={(e) => setForm({ ...form, componentType: e.target.value as MealComponentType })}
            className="h-10 w-full rounded-[10px] border border-border bg-card px-3 text-sm"
          >
            {NUTRITION_COMPONENTS.map((c) => (
              <option key={c} value={c}>{t(c)}</option>
            ))}
          </select>
        </label>
        {num("servingSizeG", t("Serving size (g)"))}
        {num("caloriesKcal", t("Energy (kcal)"))}
        {num("proteinG", t("Protein (g)"))}
        {num("carbsG", t("Carbs (g)"))}
        {num("fatG", t("Fat (g)"))}
        {num("fiberG", t("Fiber (g)"))}
        {num("sodiumMg", t("Sodium (mg)"))}
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground">
            {t("Allergens (comma separated)")}
          </span>
          <input
            value={form.allergens}
            onChange={(e) => setForm({ ...form, allergens: e.target.value })}
            placeholder="nuts, dairy"
            className="h-10 w-full rounded-[10px] border border-border bg-card px-3 text-sm"
          />
        </label>
        <label className="block space-y-1.5 sm:col-span-2 lg:col-span-3">
          <span className="text-xs font-semibold text-muted-foreground">{t("Ingredients")}</span>
          <textarea
            value={form.ingredients}
            onChange={(e) => setForm({ ...form, ingredients: e.target.value })}
            rows={3}
            className="w-full rounded-[10px] border border-border bg-card px-3 py-2 text-sm"
          />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {saving ? t("Saving…") : t("Save")}
        </button>
        {data && (
          <button
            onClick={remove}
            className="flex items-center gap-2 rounded-[10px] border border-destructive/40 px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" /> {t("Remove")}
          </button>
        )}
      </div>
    </div>
  );
}
