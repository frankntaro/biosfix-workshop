import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import BrandLogo from "./BrandLogo.jsx";
import { useAuth } from "../lib/auth.jsx";
import { NotificationProvider } from "../lib/notifications.jsx";
import { roleDisplayLine } from "../lib/roleLabels.js";
import { useOutbox } from "../lib/outbox.jsx";
import { useTheme } from "../lib/theme.jsx";
import { usePwa } from "../lib/pwa.jsx";

const linkClass = ({ isActive }) =>
  `w-full rounded-lg px-3 py-2.5 md:py-2 text-sm font-medium transition touch-manipulation min-h-[44px] md:min-h-0 flex items-center justify-center md:justify-start text-center md:text-left border border-transparent ${
    isActive
      ? "text-white tech-nav-active"
      : "text-slate-700 hover:bg-cyan-500/10 hover:border-cyan-500/15 dark:text-slate-200 dark:hover:bg-cyan-400/10 dark:hover:border-cyan-400/15"
  }`;

function MenuIcon() {
  return (
    <svg className="h-6 w-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const { online, pendingCount, lastError, flushOutbox } = useOutbox();
  const { installable, installed, promptInstall, needsRefresh, offlineReady, update, dismissRefresh } = usePwa();
  const nav = useNavigate();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  const sidebarInner = (
    <>
      <div
        className="tech-sidebar-brand w-full rounded-xl border px-3 py-4 shadow-sm flex flex-col items-center text-center gap-2 select-none"
        aria-label="BIOSFIX Workshop"
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-800 dark:text-cyan-300 leading-snug px-1">
          BIOSFIX WORKSHOP
        </p>
        <BrandLogo className="h-14 w-14 shadow-md ring-2 ring-cyan-500/25 dark:ring-cyan-400/30 tech-brand-float" />
        <p className="text-sm font-medium text-cyan-900 dark:text-cyan-200">{roleDisplayLine(user?.role)}</p>
        {user?.name &&
          user.name.trim().toLowerCase() !== roleDisplayLine(user?.role).trim().toLowerCase() && (
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-full w-full px-1">{user.name}</p>
          )}
      </div>
      <nav className="flex flex-col gap-1 w-full" aria-label="Main navigation">
        <NavLink to="/" end className={linkClass} onClick={() => setMobileNavOpen(false)}>
          Dashboard
        </NavLink>
        <NavLink to="/jobs" className={linkClass} onClick={() => setMobileNavOpen(false)}>
          {user?.role === "TECHNICIAN" ? "My jobs" : "Jobs"}
        </NavLink>
        {(user?.role === "ADMIN" || user?.role === "RECEPTION") && (
          <NavLink to="/jobs/new" className={linkClass} onClick={() => setMobileNavOpen(false)}>
            New job
          </NavLink>
        )}
        <NavLink to="/customers" className={linkClass} onClick={() => setMobileNavOpen(false)}>
          Customers
        </NavLink>
        {(user?.role === "ADMIN" || user?.role === "RECEPTION") && (
          <NavLink to="/reports" className={linkClass} onClick={() => setMobileNavOpen(false)}>
            Reports
          </NavLink>
        )}
        {user?.role === "ADMIN" && (
          <NavLink to="/activity" className={linkClass} onClick={() => setMobileNavOpen(false)}>
            Activity log
          </NavLink>
        )}
        {user?.role === "ADMIN" && (
          <NavLink to="/users" className={linkClass} onClick={() => setMobileNavOpen(false)}>
            Users
          </NavLink>
        )}
        <NavLink to="/account" className={linkClass} onClick={() => setMobileNavOpen(false)}>
          My account
        </NavLink>
      </nav>
      <div className="mt-auto flex flex-col gap-2 w-full pb-[env(safe-area-inset-bottom,0px)]">
        {installable && !installed && (
          <button
            type="button"
            onClick={() => {
              setMobileNavOpen(false);
              promptInstall();
            }}
            className="w-full rounded-lg border border-emerald-500/30 dark:border-emerald-400/25 bg-emerald-50/70 dark:bg-emerald-950/30 px-3 py-2.5 md:py-2 text-sm min-h-[44px] md:min-h-0 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/30 text-emerald-900 dark:text-emerald-100 touch-manipulation transition-colors flex items-center justify-center gap-2 font-medium"
            aria-label="Install BIOSFIX as an app"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
            </svg>
            Install app
          </button>
        )}
        <button
          type="button"
          onClick={toggle}
          className="w-full rounded-lg border border-cyan-500/20 dark:border-cyan-400/20 px-3 py-2.5 md:py-2 text-sm min-h-[44px] md:min-h-0 hover:bg-cyan-500/10 dark:hover:bg-cyan-400/10 text-cyan-950 dark:text-cyan-100 touch-manipulation transition-colors"
        >
          {dark ? "Light mode" : "Dark mode"}
        </button>
        <button
          type="button"
          onClick={() => {
            setMobileNavOpen(false);
            logout();
            nav("/login");
          }}
          className="w-full rounded-lg bg-gradient-to-r from-cyan-700 to-teal-700 dark:from-cyan-500 dark:to-teal-500 text-white px-3 py-2.5 md:py-2 text-sm font-medium min-h-[44px] md:min-h-0 touch-manipulation shadow-md shadow-cyan-900/25 hover:brightness-110 transition-all active:scale-[0.98]"
        >
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row md:items-start">
      <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 border-b border-cyan-500/15 dark:border-cyan-400/10 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-sm shadow-cyan-900/5">
        <button
          type="button"
          className="rounded-lg border border-cyan-500/20 dark:border-cyan-400/20 p-2.5 text-cyan-950 dark:text-cyan-100 touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-cyan-500/10 transition-colors"
          aria-expanded={mobileNavOpen}
          aria-controls="app-sidebar"
          aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileNavOpen((o) => !o)}
        >
          {mobileNavOpen ? (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <MenuIcon />
          )}
        </button>
        <span className="font-semibold text-sm truncate bg-gradient-to-r from-cyan-800 to-teal-700 dark:from-cyan-300 dark:to-teal-300 bg-clip-text text-transparent">
          BIOSFIX WORKSHOP
        </span>
      </header>

      {mobileNavOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 md:hidden touch-manipulation"
          aria-label="Close menu"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <aside
        id="app-sidebar"
        className={`fixed md:sticky top-0 bottom-0 md:bottom-auto left-0 z-50 md:z-auto flex w-[min(288px,88vw)] md:w-56 shrink-0 flex-col gap-6 border-r border-cyan-500/10 dark:border-cyan-400/10 bg-white/92 dark:bg-slate-950/92 backdrop-blur-md h-[100dvh] md:h-[100dvh] p-4 overflow-y-auto overscroll-contain transition-transform duration-300 ease-out md:translate-x-0 shadow-[4px_0_24px_-8px_rgba(6,182,212,0.12)] dark:shadow-[4px_0_32px_-8px_rgba(34,211,238,0.08)] pt-[max(1rem,env(safe-area-inset-top))] md:pt-4 pb-4 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <button
          type="button"
          className="md:hidden absolute top-3 right-3 rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Close menu"
          onClick={() => setMobileNavOpen(false)}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="flex flex-col gap-6 flex-1 md:pt-0 pt-8">{sidebarInner}</div>
      </aside>

      <main className="flex-1 min-w-0 w-full p-3 sm:p-6 md:p-8 pb-[max(1rem,env(safe-area-inset-bottom))] max-w-6xl mx-auto">
        {needsRefresh && (
          <div
            role="status"
            className="mb-4 rounded-xl border border-cyan-300/60 dark:border-cyan-700/50 bg-cyan-50/90 dark:bg-cyan-950/40 text-cyan-950 dark:text-cyan-100 px-4 py-3 text-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3"
          >
            <p className="font-medium">A new version is available.</p>
            <div className="flex flex-col gap-2 lg:flex-row shrink-0">
              <button
                type="button"
                onClick={update}
                className="rounded-lg tech-btn-primary text-white px-3 py-2.5 lg:py-2 text-sm font-medium min-h-[44px] lg:min-h-0 touch-manipulation"
              >
                Update now
              </button>
              <button
                type="button"
                onClick={dismissRefresh}
                className="rounded-lg border border-cyan-500/30 dark:border-cyan-400/25 px-3 py-2.5 lg:py-2 text-sm min-h-[44px] lg:min-h-0 hover:bg-cyan-500/10 touch-manipulation"
              >
                Later
              </button>
            </div>
          </div>
        )}
        {offlineReady && (
          <div
            role="status"
            className="mb-4 rounded-xl border border-emerald-300/60 dark:border-emerald-700/50 bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 px-4 py-3 text-sm"
          >
            App ready to work offline.
          </div>
        )}
        {(!online || pendingCount > 0 || lastError) && (
          <div
            className={`mb-6 rounded-xl border px-4 py-3 text-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 ${
              online
                ? "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
                : "border-slate-300 bg-slate-100 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            }`}
          >
            <div className="space-y-1 min-w-0">
              {!online && <p className="font-medium">Offline. Pending items sync after reconnect.</p>}
              {pendingCount > 0 && (
                <p>
                  <span className="font-semibold">{pendingCount}</span> pending — use Sync when online.
                </p>
              )}
              {lastError && <p className="text-red-700 dark:text-red-300 break-words">{lastError}</p>}
            </div>
            <div className="flex flex-col gap-2 shrink-0 w-full lg:w-auto lg:flex-row">
              {pendingCount > 0 && (
                <button
                  type="button"
                  disabled={!online}
                  onClick={() => flushOutbox()}
                  className="w-full lg:w-auto rounded-lg tech-btn-primary text-white px-3 py-2.5 lg:py-2 text-sm font-medium min-h-[44px] lg:min-h-0 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                >
                  Sync now
                </button>
              )}
            </div>
          </div>
        )}
        {user?.role === "TECHNICIAN" || user?.role === "ADMIN" ? (
          <NotificationProvider>
            <Outlet />
          </NotificationProvider>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
