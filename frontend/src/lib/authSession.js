const TOKEN_KEY = "biosfix_token";
const USER_KEY = "biosfix_user";

/** Decode JWT payload for offline session (display only; API still validates token). */
export function userFromToken(token) {
  if (!token || typeof token !== "string") return null;
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const padded = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(padded);
    const p = JSON.parse(json);
    if (!p?.sub) return null;
    return {
      id: p.sub,
      email: p.email || "",
      name: p.name || "",
      role: p.role || "",
      active: true,
    };
  } catch {
    return null;
  }
}

export function getCachedUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const u = JSON.parse(raw);
    return u?.id ? u : null;
  } catch {
    return null;
  }
}

export function setCachedUser(user) {
  if (!user?.id) return;
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* private mode */
  }
}

export function clearCachedUser() {
  try {
    localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else {
    localStorage.removeItem(TOKEN_KEY);
    clearCachedUser();
  }
}

/** True for fetch failures and timeouts — not auth rejection. */
export function isNetworkError(err) {
  if (!err) return false;
  if (err.name === "TypeError") return true;
  if (typeof err.message === "string") {
    const m = err.message.toLowerCase();
    return m.includes("failed to fetch") || m.includes("network") || m.includes("load failed");
  }
  return false;
}
