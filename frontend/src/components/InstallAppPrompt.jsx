import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { getInstallGuide, serviceWorkerSupported } from "../lib/installGuide.js";
import { usePwa } from "../lib/pwa.jsx";

const DISMISS_KEY = "biosfix-install-prompt-dismissed";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;
const SCROLL_SHOW_PX = 24;
const MOBILE_SHOW_MS = 600;

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

function InstallHelpDialog({ open, onClose, installable, onNativeInstall }) {
  const [status, setStatus] = useState("");
  const guide = getInstallGuide();

  useEffect(() => {
    if (!open) setStatus("");
  }, [open]);

  if (!open) return null;

  const handleNative = async () => {
    setStatus("Opening install…");
    const result = await onNativeInstall();
    if (result?.outcome === "accepted") {
      setStatus("Installed. You can open BIOSFIX from your home screen or apps.");
      return;
    }
    if (result?.outcome === "dismissed") {
      setStatus("Install cancelled. Use the steps below for your browser.");
      return;
    }
    setStatus("One-tap install is not available here. Follow the steps below.");
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-3 sm:p-6 print:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-help-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-cyan-500/25 dark:border-cyan-400/20 bg-white dark:bg-slate-900 shadow-2xl max-h-[min(85vh,32rem)] overflow-y-auto">
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3">
          <div>
            <h2 id="install-help-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Install BIOSFIX app
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Works on phones, tablets, laptops, and desktops.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-4 sm:p-5 space-y-4">
          <img
            src="/install-app-icon.png"
            alt=""
            width={64}
            height={64}
            className="h-16 w-16 rounded-2xl ring-2 ring-cyan-500/20 mx-auto"
          />
          {installable && (
            <button
              type="button"
              onClick={handleNative}
              className="w-full rounded-xl tech-btn-primary text-white font-semibold py-3 text-sm touch-manipulation min-h-[44px]"
            >
              Install now (one tap)
            </button>
          )}
          {status && (
            <p className="text-sm rounded-lg bg-cyan-50 dark:bg-cyan-950/40 text-cyan-900 dark:text-cyan-100 px-3 py-2">
              {status}
            </p>
          )}
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{guide.title}</p>
            <ol className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-400 list-decimal list-inside">
              {guide.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            {guide.note && (
              <p className="mt-3 text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 rounded-lg px-3 py-2">
                {guide.note}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-slate-300 dark:border-slate-600 py-3 text-sm font-medium touch-manipulation min-h-[44px] hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/** Small “Install app” chip + dialog with steps for every browser */
export default function InstallAppPrompt() {
  const { pathname } = useLocation();
  const { installable, installed, promptInstall } = usePwa();
  const [dismissed, setDismissed] = useState(() => wasDismissed());
  const [hasScrolled, setHasScrolled] = useState(false);
  const [mobileReady, setMobileReady] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [isMobile] = useState(() => isMobileEnvironment());

  const canPrompt = !installed && !dismissed && serviceWorkerSupported();
  const chipVisible = canPrompt && (hasScrolled || mobileReady);

  useEffect(() => {
    if (chipVisible || helpOpen) document.body.classList.add("install-prompt-open");
    else document.body.classList.remove("install-prompt-open");
    return () => document.body.classList.remove("install-prompt-open");
  }, [chipVisible, helpOpen]);

  useEffect(() => {
    setHasScrolled(false);
    setMobileReady(false);

    const markScrolled = () => setHasScrolled(true);
    const check = () => {
      if (window.scrollY >= SCROLL_SHOW_PX) markScrolled();
      const main = document.querySelector("main");
      if (main && main.scrollTop >= SCROLL_SHOW_PX) markScrolled();
      if (document.documentElement.scrollTop >= SCROLL_SHOW_PX) markScrolled();
    };

    check();
    window.addEventListener("scroll", check, { passive: true });
    document.addEventListener("scroll", check, { passive: true });
    const main = document.querySelector("main");
    main?.addEventListener("scroll", check, { passive: true });

    let timer;
    if (canPrompt && isMobile) {
      timer = window.setTimeout(() => setMobileReady(true), MOBILE_SHOW_MS);
    } else if (canPrompt && !pageCanScroll()) {
      timer = window.setTimeout(() => setHasScrolled(true), 2000);
    }

    const onTouch = () => markScrolled();
    window.addEventListener("touchmove", onTouch, { passive: true, once: true });

    return () => {
      window.removeEventListener("scroll", check);
      document.removeEventListener("scroll", check);
      main?.removeEventListener("scroll", check);
      window.removeEventListener("touchmove", onTouch);
      if (timer) clearTimeout(timer);
    };
  }, [pathname, canPrompt, isMobile]);

  useEffect(() => {
    if (!helpOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setHelpOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [helpOpen]);

  const openHelp = () => setHelpOpen(true);

  const onDismissChip = (e) => {
    e.stopPropagation();
    dismissPrompt();
    setDismissed(true);
    setHelpOpen(false);
  };

  const inAppShell = pathname !== "/login";

  return (
    <>
      <InstallHelpDialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        installable={installable}
        onNativeInstall={promptInstall}
      />

      {chipVisible && (
        <div
          className={`fixed z-[60] print:hidden pointer-events-none ${
            inAppShell ? "left-0 right-0 md:left-56" : "inset-x-0"
          } bottom-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]`}
        >
          <div className="pointer-events-auto flex justify-center sm:justify-end px-3 pb-2 sm:px-4 animate-[slideUp_0.3s_ease-out]">
            <div className="inline-flex items-center gap-0.5 rounded-full border border-cyan-500/40 dark:border-cyan-400/30 bg-cyan-900 dark:bg-slate-900 text-white shadow-lg pl-3 pr-0.5 py-0.5">
              <button
                type="button"
                onClick={openHelp}
                className="text-xs font-semibold py-2.5 pr-2 touch-manipulation min-h-[44px] flex items-center"
                aria-label="Install app — open instructions"
              >
                Install app
              </button>
              <button
                type="button"
                onClick={onDismissChip}
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
      )}
    </>
  );
}
