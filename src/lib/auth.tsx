import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { authApi, tokenStore, ApiClientError } from "@/services/apiClient";
import type { DashboardMe, NavigationNode } from "@/types/api";

interface AuthState {
  isReady: boolean;
  isAuthenticated: boolean;
  user: DashboardMe | null;
  navigation: NavigationNode[];
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DashboardMe | null>(null);
  const [navigation, setNavigation] = useState<NavigationNode[]>([]);
  const [isReady, setIsReady] = useState(false);

  const loadSession = useCallback(async () => {
    if (!tokenStore.access) {
      setUser(null);
      setNavigation([]);
      setIsReady(true);
      return;
    }
    try {
      const [me, nav] = await Promise.all([authApi.me(), authApi.navigation()]);
      setUser(me);
      setNavigation(nav);
    } catch (err) {
      if (err instanceof ApiClientError && (err.status === 401 || err.status === 403)) {
        tokenStore.clear();
      }
      setUser(null);
      setNavigation([]);
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => { void loadSession(); }, [loadSession]);

  const login = useCallback(async (email: string, password: string) => {
    const tokens = await authApi.login({ email, password });
    tokenStore.set(tokens);
    const [me, nav] = await Promise.all([authApi.me(), authApi.navigation()]);
    setUser(me);
    setNavigation(nav);
  }, []);

  const logout = useCallback(async () => {
    const rt = tokenStore.refresh;
    try { if (rt) await authApi.logout(rt); } catch { /* ignore */ }
    tokenStore.clear();
    setUser(null);
    setNavigation([]);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isReady,
        isAuthenticated: !!user,
        user,
        navigation,
        login,
        logout,
        refresh: loadSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
