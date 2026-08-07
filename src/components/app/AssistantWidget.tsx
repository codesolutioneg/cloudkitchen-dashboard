import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { assistantApi } from "@/services/apiClient";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { AssistantMessageContent } from "@/components/app/AssistantMessageContent";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "كيف أعيّن قائمة لشركة؟",
  "ما الفرق بين الكتالوج والقوائم؟",
  "كيف أعتمد إثبات الدفع؟",
  "اشرحلي القواعد بس بالبلدي",
  "كيف أوافق على منتج مخصص؟",
  "إيه الفرق بين الأدوار وقواعد العمل؟",
  "شرح دورة حياة الطلب من الأول للآخر",
];

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: t("Assistant welcome") },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [panelHeight, setPanelHeight] = useState(420);

  const showSuggestions = messages.length <= 3 && !loading;

  useLayoutEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el) return;

    const headerH = 72;
    const inputH = 76;
    const suggestionsH = showSuggestions ? 88 : 0;
    const padding = 32;
    const contentH = el.scrollHeight;
    const viewportMax = Math.floor(window.innerHeight * 0.88);
    const minH = 380;

    setPanelHeight(Math.min(Math.max(minH, headerH + inputH + suggestionsH + padding + contentH), viewportMax));
  }, [open, messages, loading, showSuggestions]);

  useEffect(() => {
    if (open) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open, messages, loading]);

  async function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q || loading) return;

    const userMsg: Msg = { role: "user", content: q };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const history = messages
        .filter((m, i) => i > 0)
        .map((m) => ({ role: m.role, content: m.content }));
      const { reply } = await assistantApi.chat(q, history);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      const err = e instanceof Error ? e.message : t("Something went wrong");
      setMessages((prev) => [...prev, { role: "assistant", content: err }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {open && (
        <div
          className={cn(
            "fixed z-[60] flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200 transition-[height] duration-200",
            "inset-x-3 bottom-20 sm:inset-x-auto sm:bottom-24 sm:end-6 sm:w-[420px]",
          )}
          style={{ height: panelHeight, maxHeight: "88vh" }}
        >
          <div className="flex items-center gap-3 border-b border-border bg-gradient-to-l from-primary/10 to-primary/5 px-4 py-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold">{t("Cloud Kitchen Assistant")}</div>
              <div className="text-xs text-muted-foreground">{t("Dashboard help in Arabic")}</div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={t("Close")}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                    m.role === "user"
                      ? "rounded-br-md bg-primary text-primary-foreground whitespace-pre-wrap"
                      : "rounded-bl-md border border-border bg-muted/50 text-foreground",
                  )}
                >
                  {m.role === "assistant" ? <AssistantMessageContent text={m.content} /> : m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("Thinking…")}
                </div>
              </div>
            )}
          </div>

          {showSuggestions && (
            <div className="flex flex-wrap gap-1.5 border-t border-border bg-muted/20 px-3 py-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:border-primary/40 hover:text-primary"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2 rounded-xl border border-border bg-background p-2 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={1}
                placeholder={t("Ask about menus, orders, catalog…")}
                className="max-h-24 min-h-[40px] flex-1 resize-none bg-transparent px-1 py-2 text-sm outline-none"
              />
              <button
                type="button"
                disabled={!input.trim() || loading}
                onClick={() => void send()}
                className="mb-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed z-[60] grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/35 transition-transform hover:scale-105 hover:bg-primary/90 active:scale-95",
          "bottom-20 end-4 sm:bottom-6 sm:end-6",
        )}
        aria-label={open ? t("Close") : t("Open assistant")}
      >
        {open ? <X className="h-6 w-6" strokeWidth={2.5} /> : <MessageCircle className="h-6 w-6" strokeWidth={2.5} />}
      </button>
    </>
  );
}
