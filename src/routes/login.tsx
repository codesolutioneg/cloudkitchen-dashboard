import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Cloud, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ApiClientError } from "@/services/apiClient";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { isReady, isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@cloudkitchen.example");
  const [password, setPassword] = useState("Admin@12345");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isReady && isAuthenticated) navigate({ to: "/dashboard", replace: true });
  }, [isReady, isAuthenticated, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    try {
      await login(email, password);
      toast.success(t("Welcome back"));
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : t("Sign in failed");
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-primary-soft/40 to-background px-4" dir="rtl">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Cloud className="h-6 w-6" />
          </div>
          <div className="text-right">
            <div className="text-xl font-bold text-foreground">{t("Cloud Kitchen")}</div>
            <div className="text-xs text-muted-foreground">{t("Super Admin Console")}</div>
          </div>
        </div>

        <div className="card-elevated p-8">
          <h1 className="text-2xl font-bold text-foreground">{t("Sign in")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("Use your dashboard credentials to continue.")}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">{t("Email")}</label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-[10px] border border-border bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="admin@cloudkitchen.example"
                dir="ltr"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">{t("Password")}</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 w-full rounded-[10px] border border-border bg-card px-3 pl-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="••••••••"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-[oklch(0.52_0.19_285)] disabled:opacity-70"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("Sign in")}
            </button>
          </form>

          <div className="mt-6 rounded-xl border border-border bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground" dir="ltr">
            <div className="mb-1 font-semibold text-foreground">Seed / test credentials</div>
            <div>Super Admin: <code>admin@cloudkitchen.example</code> / <code>Admin@12345</code></div>
            <div className="mt-1">Delivery: <code>delivery@cloudkitchen.example</code> / <code>Delivery@12345</code></div>
            <div className="mt-1">API: <code>https://api.cloud-kitchen.code-solution.org</code></div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} {t("Cloud Kitchen")}
        </p>
      </div>
    </div>
  );
}
