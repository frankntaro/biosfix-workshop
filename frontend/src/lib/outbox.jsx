import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, getToken } from "./api.js";
import { useAuth } from "./auth.jsx";
import * as idb from "./offlineDb.js";

const OutboxContext = createContext(null);

export function OutboxProvider({ children }) {
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [online, setOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));
  const [lastError, setLastError] = useState("");
  const flushing = useRef(false);

  const refreshCount = useCallback(async () => {
    try {
      setPendingCount(await idb.outboxCount());
    } catch {
      setPendingCount(0);
    }
  }, []);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  const flushOutbox = useCallback(async () => {
    if (flushing.current) return;
    setLastError("");
    if (!navigator.onLine || !getToken()) return;
    flushing.current = true;
    try {
      const rows = await idb.getAllOutbox();
      for (const row of rows) {
        try {
          if (row.type === "CREATE_JOB") {
            await api("/jobs", { method: "POST", body: row.body });
          } else if (row.type === "PATCH_JOB_STATUS") {
            const { jobId, status, notes } = row.body || {};
            if (!jobId || !status) throw new Error("Invalid queued status update");
            await api(`/jobs/${jobId}/status`, {
              method: "PATCH",
              body: { status, notes: notes || undefined },
            });
          } else {
            setLastError(`Unknown queue item type: ${row.type}`);
            break;
          }
          await idb.deleteOutboxEntry(row.id);
        } catch (e) {
          if (e.status === 401) {
            setLastError("Session expired. Sign in, then Sync.");
            break;
          }
          setLastError(e.message || "Sync paused. Retry.");
          break;
        }
      }
      await refreshCount();
    } finally {
      flushing.current = false;
    }
  }, [refreshCount]);

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      flushOutbox();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [flushOutbox]);

  useEffect(() => {
    if (user?.id) flushOutbox();
  }, [user?.id, flushOutbox]);

  const enqueueCreateJob = useCallback(
    async (body) => {
      const id = await idb.addOutboxEntry({
        type: "CREATE_JOB",
        body,
        createdAt: new Date().toISOString(),
      });
      if (id === -1) {
        throw new Error("Local storage unavailable (e.g. private browsing).");
      }
      await refreshCount();
    },
    [refreshCount]
  );

  const enqueuePatchJobStatus = useCallback(
    async ({ jobId, status, notes }) => {
      const id = await idb.addOutboxEntry({
        type: "PATCH_JOB_STATUS",
        body: { jobId, status, notes: notes || "" },
        createdAt: new Date().toISOString(),
      });
      if (id === -1) {
        throw new Error("Local storage unavailable (e.g. private browsing).");
      }
      await refreshCount();
    },
    [refreshCount],
  );

  const value = useMemo(
    () => ({
      online,
      pendingCount,
      lastError,
      enqueueCreateJob,
      enqueuePatchJobStatus,
      flushOutbox,
      refreshOutboxCount: refreshCount,
    }),
    [online, pendingCount, lastError, enqueueCreateJob, enqueuePatchJobStatus, flushOutbox, refreshCount],
  );

  return <OutboxContext.Provider value={value}>{children}</OutboxContext.Provider>;
}

export function useOutbox() {
  const ctx = useContext(OutboxContext);
  if (!ctx) throw new Error("useOutbox must be used inside OutboxProvider");
  return ctx;
}
