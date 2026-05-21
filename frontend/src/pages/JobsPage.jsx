import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import * as idb from "../lib/offlineDb.js";
import {
  JOBS_PAGE_STATUS_FILTER,
  statusBadgeClass,
  statusDescription,
  statusLabel,
} from "../lib/status.js";
import PaginationFooter from "../components/PaginationFooter.jsx";
import { JobDeviceTableCells, JobDeviceTableHead } from "../components/JobDeviceTableCells.jsx";

const PAGE_SIZE = 5;

export default function JobsPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get("status") || "";
  const statusFilterMeta = JOBS_PAGE_STATUS_FILTER[statusFilter] || null;
  const [jobs, setJobs] = useState([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [listMeta, setListMeta] = useState({ total: 0, totalPages: 0, page: 1, pageSize: PAGE_SIZE });
  const [err, setErr] = useState("");
  const [offlineNote, setOfflineNote] = useState("");
  const [fromCache, setFromCache] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);

  const canCancelJobs = user?.role === "ADMIN" || user?.role === "RECEPTION";

  useEffect(() => {
    if (location.state?.offlineQueued) {
      setOfflineNote("Job queued on this device. Sync when online.");
    }
  }, [location.state]);

  useEffect(() => {
    setPage(1);
  }, [q, statusFilter]);

  const load = useCallback(async () => {
    setErr("");
    if (!navigator.onLine) {
      const raw = await idb.getJobListCache();
      if (!raw?.length) {
        setJobs([]);
        setFromCache(false);
        setListMeta({ total: 0, totalPages: 0, page: 1, pageSize: PAGE_SIZE });
        setErr("Offline. No cached job list.");
        return;
      }
      let filtered = idb.filterJobsLocal(raw, q);
      if (statusFilterMeta) {
        filtered = filtered.filter((j) => j.status === statusFilter);
      } else {
        filtered = filtered.filter((j) => j.status !== "CANCELLED");
      }
      const total = filtered.length;
      const totalPages = total === 0 ? 0 : Math.ceil(total / PAGE_SIZE);
      const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);
      const start = (safePage - 1) * PAGE_SIZE;
      setJobs(filtered.slice(start, start + PAGE_SIZE));
      setListMeta({ total, totalPages, page: safePage, pageSize: PAGE_SIZE });
      if (safePage !== page) setPage(safePage);
      setFromCache(true);
      return;
    }
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (q.trim()) params.set("q", q.trim());
    if (statusFilterMeta) params.set("status", statusFilter);
    const path = q.trim() ? `/jobs/search?${params}` : `/jobs?${params}`;
    try {
      const data = await api(path);
      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      setJobs(items);
      setFromCache(false);
      if (data && typeof data.total === "number") {
        setListMeta({
          total: data.total,
          totalPages: data.totalPages ?? 0,
          page: data.page ?? page,
          pageSize: data.pageSize ?? PAGE_SIZE,
        });
        setPage(data.page ?? page);
      } else {
        setListMeta({ total: items.length, totalPages: items.length ? 1 : 0, page: 1, pageSize: PAGE_SIZE });
        setPage(1);
      }
      await idb.mergeJobListCache(items);
    } catch (e) {
      const raw = await idb.getJobListCache();
      if (raw?.length) {
        let filtered = idb.filterJobsLocal(raw, q);
        if (statusFilterMeta) {
          filtered = filtered.filter((j) => j.status === statusFilter);
        } else {
          filtered = filtered.filter((j) => j.status !== "CANCELLED");
        }
        const total = filtered.length;
        const totalPages = total === 0 ? 0 : Math.ceil(total / PAGE_SIZE);
        const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);
        const start = (safePage - 1) * PAGE_SIZE;
        setJobs(filtered.slice(start, start + PAGE_SIZE));
        setListMeta({ total, totalPages, page: safePage, pageSize: PAGE_SIZE });
        if (safePage !== page) setPage(safePage);
        setFromCache(true);
        setErr("");
      } else {
        setErr(e.message);
      }
    }
  }, [q, page, statusFilter, statusFilterMeta]);

  useEffect(() => {
    const t = setTimeout(() => load(), 300);
    return () => clearTimeout(t);
  }, [q, page, load]);

  useEffect(() => {
    const onUp = () => load();
    window.addEventListener("online", onUp);
    return () => window.removeEventListener("online", onUp);
  }, [load]);

  async function cancelJob(job) {
    if (
      !window.confirm(
        `Cancel job ${job.jobNumber}? The customer stays in the system; this job will leave the dashboard and active lists.`,
      )
    ) {
      return;
    }
    setErr("");
    setCancellingId(job.id);
    try {
      if (!navigator.onLine) {
        setErr("Internet required to cancel a job.");
        return;
      }
      await api(`/jobs/${job.id}/status`, {
        method: "PATCH",
        body: { status: "CANCELLED", notes: "Cancelled" },
      });
      await load();
    } catch (e) {
      setErr(e.message || "Could not cancel job");
    } finally {
      setCancellingId(null);
    }
  }

  const closable = (status) => !["DELIVERED", "CANCELLED"].includes(status);

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Jobs</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Search by job number, customer, or phone.</p>
          {fromCache && (
            <p className="text-sm text-amber-800 dark:text-amber-200 mt-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/90 dark:bg-amber-950/40 px-3 py-2 max-w-xl">
              Cached list. Connect for live data.
            </p>
          )}
        </div>
        {(user?.role === "ADMIN" || user?.role === "RECEPTION") && (
          <Link
            to="/jobs/new"
            className="inline-flex justify-center items-center w-full lg:w-auto rounded-lg bg-sky-600 text-white px-4 py-3 lg:py-2 text-sm font-medium hover:bg-sky-500 touch-manipulation min-h-[44px] lg:min-h-0 shrink-0"
          >
            New job
          </Link>
        )}
      </div>
      {statusFilterMeta && (
        <div className="rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50/90 dark:bg-sky-950/40 px-4 py-3 text-sm text-sky-950 dark:text-sky-100 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p>
            <span className="font-medium">{statusFilterMeta.title}:</span> {statusFilterMeta.description}
          </p>
          <Link to="/jobs" className="font-medium text-sky-700 dark:text-sky-300 hover:underline shrink-0 touch-manipulation">
            Show all jobs
          </Link>
        </div>
      )}
      {offlineNote && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100 px-4 py-3 text-sm flex flex-col gap-3 lg:flex-row lg:justify-between lg:items-start">
          <p className="min-w-0">{offlineNote}</p>
          <button
            type="button"
            className="text-emerald-800 dark:text-emerald-200 underline shrink-0 text-left lg:text-right py-1 touch-manipulation min-h-[44px] lg:min-h-0 flex items-center"
            onClick={() => setOfflineNote("")}
          >
            Dismiss
          </button>
        </div>
      )}
      <input
        placeholder="Search…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full max-w-md rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
      />
      {err && <p className="text-red-600 text-sm">{err}</p>}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
              <th className="p-3">Job</th>
              <th className="p-3">Customer</th>
              <JobDeviceTableHead thClass="p-3" />
              <th className="p-3">Status</th>
              <th className="p-3">Updated</th>
              {canCancelJobs && <th className="p-3 w-28">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                <td className="p-3 font-mono">
                  <Link className="text-sky-600 hover:underline" to={`/jobs/${j.id}`}>
                    {j.jobNumber}
                  </Link>
                </td>
                <td className="p-3">
                  <div className="font-medium">{j.customer?.name}</div>
                  <div className="text-xs text-slate-500">{j.customer?.phone}</div>
                </td>
                <JobDeviceTableCells device={j.device} tdClass="p-3" />
                <td className="p-3">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs ${statusBadgeClass(j.status)}`}
                    title={statusDescription(j.status)}
                  >
                    {statusLabel(j.status)}
                  </span>
                </td>
                <td className="p-3 text-slate-500 whitespace-nowrap">{new Date(j.updatedAt).toLocaleString()}</td>
                {canCancelJobs && (
                  <td className="p-3">
                    {closable(j.status) ? (
                      <button
                        type="button"
                        disabled={cancellingId === j.id}
                        onClick={() => cancelJob(j)}
                        className="rounded-lg border border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 px-2.5 py-1.5 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50 touch-manipulation"
                      >
                        {cancellingId === j.id ? "…" : "Cancel"}
                      </button>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!jobs.length && <p className="p-6 text-center text-slate-500">No jobs found</p>}
        <PaginationFooter
          page={listMeta.page}
          totalPages={listMeta.totalPages}
          total={listMeta.total}
          pageSize={listMeta.pageSize}
          noun="jobs"
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
