import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { usePwa } from "../lib/pwa.jsx";

const DISMISS_KEY = "biosfix-install-prompt-dismissed";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;
const SCROLL_SHOW_PX = 24;
const MOBILE_SHOW_MS = 600;

function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isMobileEnvironment() {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia?.("(pointer: coarse)")?.matches;
  const narrow = window.matchMedia?.("(max-width: 768px)")?.matches;
  const mobileUa = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
  return Boolean(coarse || narrow || mobileUa);
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

function pageCanScroll() {
  const doc = document.documentElement;
  return doc.scrollHeight > doc.clientHeight + 8;
}

/** Small chip: “Install app” — scroll on desktop; auto-show on phones/tablets */
export default function InstallAppPrompt() {
  const { pathname } = useLocation();
  const { installable, installed, promptInstall } = usePwa();
  const [dismissed, setDismissed] = useState(() => wasDismissed());
  const [hasScrolled, setHasScrolled] = useState(false);
  const [mobileReady, setMobileReady] = useState(false);
  const [isMobile] = useState(() => isMobileEnvironment());

  const canPrompt =
    !installed &&
    !dismissed &&
    (installable || isIosDevice() || isMobile);

  const visible = canPrompt && (hasScrolled || mobileReady);

  useEffect(() => {
    if (visible) document.body.classList.add("install-prompt-open");
    else document.body.classList.remove("install-prompt-open");
    return () => document.body.classList.remove("install-prompt-open");
  }, [visible]);

  useEffect(() => {
    setHasScrolled(false);
    setMobileReady(false);

    const markScrolled = () => setHasScrolled(true);

    const check = () => {
      if (window.scrollY >= SCROLL_SHOW_PX) markScrolled();
      const main = document.querySelector("main");
      if (main && main.scrollTop >= SCROLL_SHOW_PX) markScrolled();
      const doc = document.documentElement;
      if (doc.scrollTop >= SCROLL_SHOW_PX) markScrolled();
    };

    check();

    window.addEventListener("scroll", check, { passive: true });
    document.addEventListener("scroll", check, { passive: true });
    const main = document.querySelector("main");
    main?.addEventListener("scroll", check, { passive: true });

    let mobileTimer;
    if (canPrompt && isMobile) {
      mobileTimer = window.setTimeout(() => setMobileReady(true), MOBILE_SHOW_MS);
    } else if (canPrompt && pageCanScroll()) {
      /* desktop: wait for scroll */
    } else if (canPrompt) {
      mobileTimer = window.setTimeout(() => setHasScrolled(true), 2000);
    }

    const onTouch = () => markScrolled();
    window.addEventListener("touchmove", onTouch, { passive: true, once: true });

    return () => {
      window.removeEventListener("scroll", check);
      document.removeEventListener("scroll", check);
      main?.removeEventListener("scroll", check);
      window.removeEventListener("touchmove", onTouch);
      if (mobileTimer) clearTimeout(mobileTimer);
    };
  }, [pathname, canPrompt, isMobile]);

  if (!visible) return null;

  const onInstall = async () => {
    if (installable) {
      await promptInstall();
      return;
    }
    if (isIosDevice()) {
      window.alert("To install: tap Share, then Add to Home Screen.");
    }
  };

  const onDismiss = (e) => {
    e.stopPropagation();
    dismissPrompt();
    setDismissed(true);
  };

  const inAppShell = pathname !== "/login";

  return (
    <div
      className={`fixed z-[60] print:hidden pointer-events-none ${
        inAppShell ? "left-0 right-0 md:left-56" : "inset-x-0"
      } bottom-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]`}
    >
      <div className="pointer-events-auto flex justify-center sm:justify-end px-3 pb-2 sm:px-4 animate-[slideUp_0.3s_ease-out]">
        <div className="inline-flex items-center gap-0.5 rounded-full border border-cyan-500/40 dark:border-cyan-400/30 bg-cyan-900 dark:bg-slate-900 text-white shadow-lg pl-3 pr-0.5 py-0.5">
          <button
            type="button"
            onClick={onInstall}
            className="text-xs font-semibold py-2.5 pr-2 touch-manipulation min-h-[44px] flex items-center"
            aria-label="Install app"
          >
            Install app
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-full p-2 text-cyan-200/90 hover:bg-white/10 touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Dismiss"
          >
            <span className="text-base leading-none" aria-hidden>
              ×
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
