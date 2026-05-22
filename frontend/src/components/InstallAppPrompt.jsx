import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { usePwa } from "../lib/pwa.jsx";

const DISMISS_KEY = "biosfix-install-prompt-dismissed";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;
const SCROLL_SHOW_PX = 48;

function isIosSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua);
  const webkit = /webkit/i.test(ua);
  return ios && webkit && !/crios|fxios/i.test(ua);
}

function wasDismissed() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const t = Number(raw);
    return Number.isFinite(t) && Date.now() - t < DISMISS_MS;
  } catch {
    return false;
  }
}

function dismissPrompt() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/** Small scroll-triggered chip: “Install app” only */
export default function InstallAppPrompt() {
  const { pathname } = useLocation();
  const { installable, installed, promptInstall } = usePwa();
  const [dismissed, setDismissed] = useState(() => wasDismissed());
  const [hasScrolled, setHasScrolled] = useState(false);
  const [iosHint] = useState(() => isIosSafari());

  const canPrompt = !installed && !dismissed && (installable || iosHint);
  const visible = canPrompt && hasScrolled;

  useEffect(() => {
    if (visible) document.body.classList.add("install-prompt-open");
    else document.body.classList.remove("install-prompt-open");
    return () => document.body.classList.remove("install-prompt-open");
  }, [visible]);

  useEffect(() => {
    const check = () => {
      if (window.scrollY >= SCROLL_SHOW_PX) setHasScrolled(true);
      const main = document.querySelector("main");
      if (main?.scrollTop >= SCROLL_SHOW_PX) setHasScrolled(true);
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    const main = document.querySelector("main");
    main?.addEventListener("scroll", check, { passive: true });
    return () => {
      window.removeEventListener("scroll", check);
      main?.removeEventListener("scroll", check);
    };
  }, [pathname]);

  useEffect(() => {
    if (!canPrompt || pathname !== "/login") return;
    const t = window.setTimeout(() => setHasScrolled(true), 1500);
    return () => clearTimeout(t);
  }, [canPrompt, pathname]);

  if (!visible) return null;

  const onInstall = async () => {
    if (installable) await promptInstall();
  };

  const onDismiss = (e) => {
    e.stopPropagation();
    dismissPrompt();
    setDismissed(true);
  };

  const inAppShell = pathname !== "/login";

  return (
    <div
      className={`fixed z-[45] print:hidden pointer-events-none ${
        inAppShell ? "left-0 right-0 md:left-56" : "inset-x-0"
      } bottom-0 pb-[max(0.5rem,env(safe-area-inset-bottom))]`}
    >
      <div className="pointer-events-auto flex justify-end px-3 pb-2 sm:px-4 animate-[slideUp_0.3s_ease-out]">
        <div className="inline-flex items-center gap-0.5 rounded-full border border-cyan-500/30 dark:border-cyan-400/25 bg-cyan-900/95 dark:bg-slate-900/95 text-white shadow-md backdrop-blur-sm pl-3 pr-0.5 py-0.5">
          <button
            type="button"
            onClick={onInstall}
            className="text-xs font-semibold tracking-wide py-2 pr-2 touch-manipulation hover:text-cyan-200 transition-colors"
            aria-label="Install app"
          >
            Install app
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-full p-1.5 text-cyan-200/80 hover:bg-white/10 hover:text-white touch-manipulation min-h-[32px] min-w-[32px] flex items-center justify-center"
            aria-label="Dismiss install prompt"
          >
            <span className="text-sm leading-none" aria-hidden>
              ×
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
