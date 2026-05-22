import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api.js";
import {
  clearCachedUser,
  getCachedUser,
  getToken,
  isNetworkError,
  setCachedUser,
  setToken,
  userFromToken,
} from "./authSession.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const t = getToken();
    if (!t) {
      setUser(null);
      setLoading(false);
      return;
    }

    const offlineBootstrap = getCachedUser() || userFromToken(t);
    if (!navigator.onLine && offlineBootstrap) {
      setUser(offlineBootstrap);
      setLoading(false);
      return;
    }

    try {
      const me = await api("/auth/me");
      setUser(me);
      setCachedUser(me);
    } catch (e) {
      if (e.status === 401 || e.status === 403) {
        setToken(null);
        setUser(null);
      } else if (!navigator.onLine || isNetworkError(e)) {
        setUser(offlineBootstrap);
      } else {
        setUser(offlineBootstrap);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email, password) => {
    const data = await api("/auth/login", { method: "POST", body: { email, password } });
    setToken(data.token);
    setUser(data.user);
    setCachedUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    clearCachedUser();
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout, refresh }), [user, loading, login, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside provider");
  return ctx;
}
