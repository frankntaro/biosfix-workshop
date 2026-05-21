import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "./api.js";

/** Dispatch after job updates so open sessions poll notifications immediately. */
export const NOTIFICATIONS_REFRESH_EVENT = "biosfix:notifications-refresh";

const NotificationContext = createContext(null);

function BellIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
  );
}

export function NotificationProvider({ children }) {
  const nav = useNavigate();
  const firstPollRef = useRef(true);
  const prevUnreadIdsRef = useRef(new Set());
  const toastTimersRef = useRef(new Map());
  const markOneReadRef = useRef(async () => {});

  const [panelOpen, setPanelOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [toasts, setToasts] = useState([]);

  const applyPayload = useCallback((data, options = { detectNewToasts: false }) => {
    const list = Array.isArray(data?.items) ? data.items : [];
    const u = typeof data?.unread === "number" ? data.unread : list.filter((i) => !i.readAt).length;
    setItems(list);
    setUnread(u);

    const unreadIds = new Set(list.filter((n) => !n.readAt).map((n) => n.id));
    if (options.detectNewToasts && !firstPollRef.current) {
      for (const n of list) {
        if (!n.readAt && !prevUnreadIdsRef.current.has(n.id)) {
          const key = `t-${n.id}`;
          setToasts((prev) => {
            if (prev.some((t) => t.key === key)) return prev;
            return [...prev, { key, notifId: n.id, title: n.title, body: n.body, jobId: n.job?.id }];
          });
          const notifId = n.id;
          const tid = window.setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.key !== key));
            toastTimersRef.current.delete(key);
            void markOneReadRef.current(notifId);
          }, 7000);
          toastTimersRef.current.set(key, tid);
        }
      }
    }
    firstPollRef.current = false;
    prevUnreadIdsRef.current = unreadIds;
  }, []);

  const load = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const data = await api("/notifications");
      applyPayload(data, { detectNewToasts: true });
    } catch {
      /* ignore */
    }
  }, [applyPayload]);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 10000);
    const onRefresh = () => load();
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, onRefresh);
    window.addEventListener("focus", onRefresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, onRefresh);
      window.removeEventListener("focus", onRefresh);
      document.removeEventListener("visibilitychange", onVisible);
      toastTimersRef.current.forEach((t) => clearTimeout(t));
      toastTimersRef.current.clear();
    };
  }, [load]);

  const markOneRead = useCallback(
    async (notifId) => {
      try {
        await api(`/notifications/${notifId}/read`, { method: "PATCH", body: {} });
        const data = await api("/notifications");
        applyPayload(data, { detectNewToasts: false });
      } catch {
        /* ignore */
      }
    },
    [applyPayload],
  );

  useEffect(() => {
    markOneReadRef.current = markOneRead;
  }, [markOneRead]);

  const markAllRead = useCallback(async () => {
    try {
      await api("/notifications/read-all", { method: "POST", body: {} });
      setPanelOpen(false);
      const data = await api("/notifications");
      applyPayload(data, { detectNewToasts: false });
    } catch {
      /* ignore */
    }
  }, [applyPayload]);

  const onToastActivate = useCallback(
    async (t) => {
      const timer = toastTimersRef.current.get(t.key);
      if (timer) clearTimeout(timer);
      toastTimersRef.current.delete(t.key);
      setToasts((prev) => prev.filter((x) => x.key !== t.key));
      await markOneRead(t.notifId);
      if (t.jobId) nav(`/jobs/${t.jobId}`);
    },
    [markOneRead, nav],
  );

  const dismissToastMarkRead = useCallback(
    async (key, notifId) => {
      const timer = toastTimersRef.current.get(key);
      if (timer) clearTimeout(timer);
      toastTimersRef.current.delete(key);
      setToasts((prev) => prev.filter((t) => t.key !== key));
      await markOneRead(notifId);
    },
    [markOneRead],
  );

  const value = {
    panelOpen,
    setPanelOpen,
    items,
    unread,
    markOneRead,
    markAllRead,
    nav,
    toasts,
    onToastActivate,
    dismissToastMarkRead,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

/** Toast popups — dashboard header top-right only (mobile + desktop). */
export function DashboardToastStack() {
  const { toasts, onToastActivate, dismissToastMarkRead } = useNotifications();

  if (toasts.length === 0) return null;

  return (
    <div
      id="dashboard-toast-stack"
      className="fixed z-[60] flex flex-col gap-2 items-end pointer-events-none print:hidden top-[max(4.25rem,calc(env(safe-area-inset-top,0px)+3.5rem))] right-3 sm:top-6 sm:right-6 md:top-8 md:right-8 max-w-[min(20rem,calc(100vw-1.5rem))]"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.key}
          className="pointer-events-auto w-full flex rounded-xl border border-cyan-500/25 dark:border-cyan-400/20 bg-white/95 dark:bg-slate-900/95 shadow-lg overflow-hidden backdrop-blur-sm"
        >
          <button
            type="button"
            onClick={() => onToastActivate(t)}
            className="flex-1 text-left px-4 py-3 text-sm min-w-0"
          >
            <p className="font-semibold text-slate-900 dark:text-slate-100">{t.title}</p>
            {t.body && (
              <p className="text-slate-600 dark:text-slate-400 mt-1 line-clamp-4 whitespace-pre-wrap">{t.body}</p>
            )}
            <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-2">
              {t.jobId ? "Tap to open job" : "Tap to dismiss"}
            </p>
          </button>
          <button
            type="button"
            className="shrink-0 px-3 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 text-xl leading-none"
            aria-label="Dismiss and mark read"
            onClick={() => dismissToastMarkRead(t.key, t.notifId)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications requires NotificationProvider");
  return ctx;
}

/** Bell + dropdown — place in dashboard header top-right. */
export function NotificationBellButton() {
  const { panelOpen, setPanelOpen, items, unread, markOneRead, markAllRead, nav } = useNotifications();
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!panelOpen) return;
    function onDoc(e) {
      if (e.target.closest("#dashboard-toast-stack")) return;
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setPanelOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [panelOpen, setPanelOpen]);

  return (
    <div className="relative shrink-0 print:hidden" ref={wrapRef}>
      <button
        type="button"
        className="relative rounded-xl border border-cyan-500/25 dark:border-cyan-400/20 bg-white/80 dark:bg-slate-900/80 p-2.5 text-cyan-900 dark:text-cyan-100 hover:bg-cyan-500/10 dark:hover:bg-slate-800 touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-expanded={panelOpen}
        aria-haspopup="true"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        onClick={() => setPanelOpen((o) => !o)}
      >
        <BellIcon className="h-6 w-6" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1 rounded-full bg-cyan-600 text-white text-[11px] font-bold flex items-center justify-center leading-none">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {panelOpen && (
        <div
          className="absolute right-0 mt-2 w-[min(calc(100vw-2rem),20rem)] max-h-[min(24rem,70vh)] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 shadow-xl z-50 py-2 text-sm"
          role="menu"
        >
          {items.length === 0 ? (
            <p className="px-4 py-6 text-slate-500 text-center">None</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-900/80 touch-manipulation ${
                      n.readAt ? "opacity-70" : "bg-cyan-50/50 dark:bg-cyan-950/20"
                    }`}
                    onClick={async () => {
                      if (!n.readAt) await markOneRead(n.id);
                      setPanelOpen(false);
                      if (n.job?.id) nav(`/jobs/${n.job.id}`);
                    }}
                  >
                    <p className="font-medium text-slate-900 dark:text-slate-100">{n.title}</p>
                    {n.body && <p className="text-slate-600 dark:text-slate-400 text-xs mt-1 line-clamp-2">{n.body}</p>}
                    <p className="text-[11px] text-slate-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {unread > 0 && (
            <div className="border-t border-slate-100 dark:border-slate-800 p-2">
              <button
                type="button"
                className="w-full rounded-lg bg-slate-100 dark:bg-slate-800 py-2.5 text-xs font-medium text-slate-800 dark:text-slate-200 touch-manipulation"
                onClick={() => markAllRead()}
              >
                Mark all read
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
