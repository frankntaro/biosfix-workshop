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

/**
 * Scroll-triggered install banner (not a sidebar button). Shown when the user scrolls
 * and the app can be installed (Chrome/Edge) or on iOS with Add to Home Screen steps.
 */
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
    if (installable) {
      await promptInstall();
      return;
    }
  };

  const onDismiss = () => {
    dismissPrompt();
    setDismissed(true);
  };

  const inAppShell = pathname !== "/login";

  return (
    <div
      role="dialog"
      aria-labelledby="install-prompt-title"
      aria-describedby="install-prompt-desc"
      className={`fixed z-[45] print:hidden pointer-events-none ${
        inAppShell ? "left-0 right-0 md:left-56" : "inset-x-0"
      } bottom-0 pb-[env(safe-area-inset-bottom)]`}
    >
      <div className="pointer-events-auto mx-3 mb-3 sm:mx-4 sm:mb-4 rounded-2xl border border-cyan-500/35 dark:border-cyan-400/25 bg-gradient-to-r from-cyan-950 via-teal-900 to-cyan-950 text-white shadow-2xl shadow-cyan-950/50 overflow-hidden animate-[slideUp_0.35s_ease-out]">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 sm:p-5">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <img
              src="/install-app-icon.png"
              alt=""
              width={72}
              height={72}
              className="h-[4.5rem] w-[4.5rem] shrink-0 rounded-2xl ring-2 ring-white/20 shadow-lg"
            />
            <div className="min-w-0">
              <p id="install-prompt-title" className="font-bold text-base sm:text-lg leading-snug">
                Install BIOSFIX on this device
              </p>
              <p id="install-prompt-desc" className="text-sm text-cyan-100/90 mt-1 leading-relaxed">
                {installable
                  ? "Get the workshop app on your home screen or desktop — works faster and supports offline jobs."
                  : "On iPhone or iPad: tap Share, then Add to Home Screen. On Android: use the browser menu Install app."}
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full sm:w-auto">
            {installable ? (
              <button
                type="button"
                onClick={onInstall}
                className="w-full sm:w-auto rounded-xl bg-white text-cyan-950 font-semibold px-5 py-3 text-sm touch-manipulation min-h-[44px] hover:bg-cyan-50 transition-colors"
              >
                Install now
              </button>
            ) : (
              <button
                type="button"
                onClick={onDismiss}
                className="w-full sm:w-auto rounded-xl bg-white/15 border border-white/25 font-semibold px-5 py-3 text-sm touch-manipulation min-h-[44px] hover:bg-white/25"
              >
                Got it
              </button>
            )}
            <button
              type="button"
              onClick={onDismiss}
              className="w-full sm:w-auto rounded-xl border border-white/20 text-cyan-100 px-5 py-3 text-sm touch-manipulation min-h-[44px] hover:bg-white/10"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
