import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { registerSW } from "virtual:pwa-register";

const PwaContext = createContext(null);

export function PwaProvider({ children }) {
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [installable, setInstallable] = useState(false);
  const [installed, setInstalled] = useState(false);
  const updateSWRef = useRef(null);
  const deferredPromptRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    updateSWRef.current = registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedsRefresh(true);
      },
      onOfflineReady() {
        setOfflineReady(true);
        setTimeout(() => setOfflineReady(false), 6000);
      },
      onRegisterError(err) {
        // eslint-disable-next-line no-console
        console.warn("[PWA] SW registration failed:", err);
      },
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onBeforeInstall = (e) => {
      e.preventDefault();
      deferredPromptRef.current = e;
      setInstallable(true);
    };

    const onInstalled = () => {
      deferredPromptRef.current = null;
      setInstallable(false);
      setInstalled(true);
    };

    const mq = window.matchMedia?.("(display-mode: standalone)");
    const detectStandalone = () => {
      const standalone =
        mq?.matches ||
        // iOS Safari
        // eslint-disable-next-line no-restricted-globals
        window.navigator.standalone === true;
      setInstalled(Boolean(standalone));
    };
    detectStandalone();

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    mq?.addEventListener?.("change", detectStandalone);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      mq?.removeEventListener?.("change", detectStandalone);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    const e = deferredPromptRef.current;
    if (!e) return { outcome: "unavailable" };
    e.prompt();
    const choice = await e.userChoice.catch(() => ({ outcome: "dismissed" }));
    deferredPromptRef.current = null;
    setInstallable(false);
    return choice;
  }, []);

  const update = useCallback(async () => {
    setNeedsRefresh(false);
    if (updateSWRef.current) {
      await updateSWRef.current(true);
    } else if (typeof window !== "undefined") {
      window.location.reload();
    }
  }, []);

  const dismissRefresh = useCallback(() => setNeedsRefresh(false), []);

  const value = useMemo(
    () => ({
      needsRefresh,
      offlineReady,
      installable,
      installed,
      update,
      dismissRefresh,
      promptInstall,
    }),
    [needsRefresh, offlineReady, installable, installed, update, dismissRefresh, promptInstall],
  );

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}

export function usePwa() {
  const ctx = useContext(PwaContext);
  if (!ctx) throw new Error("usePwa outside provider");
  return ctx;
}
