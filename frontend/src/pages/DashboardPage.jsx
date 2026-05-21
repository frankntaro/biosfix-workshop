import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { useOutbox } from "../lib/outbox.jsx";
import * as idb from "../lib/offlineDb.js";
import { JobDeviceSummary, JobDeviceTableCells, JobDeviceTableHead } from "../components/JobDeviceTableCells.jsx";
import { DashboardToastStack, NotificationBellButton } from "../lib/notifications.jsx";
import { TECH_QUICK_STATUSES, statusBadgeClass, statusDescription, statusLabel } from "../lib/status.js";

export default function DashboardPage() {
  const { user } = useAuth();
  const { enqueuePatchJobStatus } = useOutbox();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [fromCache, setFromCache] = useState(false);
  const [techActionMsg, setTechActionMsg] = useState("");
  const [techActionErr, setTechActionErr] = useState("");

  const handleTechQuickStatus = useCallback(
    async (jobId, nextStatus) => {
      setTechActionMsg("");
      setTechActionErr("");
      try {
        if (!navigator.onLine) {
          await enqueuePatchJobStatus({ jobId, status: nextStatus, notes: "" });
          setTechActionMsg("Queued. Sync when online.");
          return;
        }
        await api(`/jobs/${jobId}/status`, { method: "PATCH", body: { status: nextStatus } });
        setTechActionMsg("Status updated.");
        const d = await api("/dashboard/summary");
        setData(d);
        await idb.putDashboardCache(d);
      } catch (e) {
        setTechActionErr(e.message || "Could not update status");
      }
    },
    [enqueuePatchJobStatus, user?.role],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      if (!navigator.onLine) {
        const cached = await idb.getDashboardCache();
        if (cancelled) return;
        if (cached) {
          setData(cached);
          setFromCache(true);
          setErr("");
        } else {
          setErr("Offline. No cached dashboard for this device.");
        }
        return;
      }
      setFromCache(false);
      try {
        const d = await api("/dashboard/summary");
        if (cancelled) return;
        setData(d);
        await idb.putDashboardCache(d);
        setErr("");
      } catch (e) {
        const cached = await idb.getDashboardCache();
        if (cancelled) return;
        if (cached) {
          setData(cached);
          setFromCache(true);
          setErr("");
        } else {
          setErr(e.message);
        }
      }
    }

    loadSummary();

    const onUp = () => loadSummary();
    window.addEventListener("online", onUp);

    let interval;
    if (typeof navigator !== "undefined" && navigator.onLine) {
      if (user?.role === "RECEPTION" || user?.role === "ADMIN") {
        interval = setInterval(loadSummary, 20000);
      } else if (user?.role === "TECHNICIAN") {
        interval = setInterval(loadSummary, 25000);
      }
    }

    return () => {
      cancelled = true;
      window.removeEventListener("online", onUp);
      if (interval) clearInterval(interval);
    };
  }, [user?.role]);

  if (err) return <p className="text-red-600">{err}</p>;
  if (!data) return (
    <div className="flex items-center gap-3 text-slate-600 dark:text-cyan-200/80 py-8">
      <span className="tech-led-dot shrink-0" aria-hidden />
      <span>Loading…</span>
    </div>
  );

  const cards = [
    { label: "Jobs today", value: data.totalJobsToday },
    { label: "Pending", value: data.pendingJobs, to: "/jobs?status=PENDING" },
    { label: "Completed", value: data.completedJobs, to: "/jobs?status=COMPLETE" },
    { label: "Under repair", value: data.devicesUnderRepair, to: "/jobs?status=IN_PROGRESS" },
    { label: "Revenue today", value: `TZS ${data.revenueToday.toLocaleString()}` },
    { label: "Revenue (week)", value: `TZS ${data.revenueWeek.toLocaleString()}` },
    { label: "Revenue (month)", value: `TZS ${data.revenueMonth.toLocaleString()}` },
  ];

  const isTechScope = data.scopedToTechnician === true;
  const isAdmin = user?.role === "ADMIN";
  const isReception = user?.role === "RECEPTION";
  const showTodayIntakes = !isTechScope && (isReception || isAdmin);
  const showWorkshopQuickActions = isTechScope || isAdmin;
  const showOpsShortcuts = isReception || isAdmin;

  return (
    <div className="space-y-8">
      <DashboardToastStack />
      <header className="flex items-start justify-between gap-3 print:hidden">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight tech-heading-gradient">
            {user?.role === "ADMIN"
              ? "Dashboard"
              : user?.role === "RECEPTION"
                ? "Reception"
                : user?.role === "TECHNICIAN"
                  ? "Workshop"
                  : "Dashboard"}
          </h1>
          <p className="text-slate-600 dark:text-cyan-200/70 text-sm mt-2 flex flex-wrap items-center gap-2">
            <span className="tech-led-dot shrink-0" aria-hidden />
            {isTechScope ? "Assigned jobs" : isAdmin ? "Workshop overview" : "Overview"}
          </p>
          {fromCache && (
            <p className="text-sm text-amber-800 dark:text-amber-200 mt-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/90 dark:bg-amber-950/40 px-3 py-2 max-w-2xl print:hidden">
              Cached figures. Connect for live data.
            </p>
          )}
        </div>
        {(user?.role === "TECHNICIAN" || user?.role === "ADMIN") && (
          <div className="hidden md:block shrink-0 ml-2">
            <NotificationBellButton />
          </div>
        )}
      </header>
      {showWorkshopQuickActions && (
        <section className="tech-glass p-4 sm:p-5 border border-sky-500/20 dark:border-sky-700/30 print:hidden">
          <h2 className="font-semibold text-sky-900 dark:text-sky-100 mb-3">Workshop status</h2>
          {techActionMsg && <p className="text-sm text-emerald-600 dark:text-emerald-400 mb-2">{techActionMsg}</p>}
          {techActionErr && <p className="text-sm text-red-600 dark:text-red-400 mb-2">{techActionErr}</p>}
          <ul className="space-y-3">
            {(data.recentJobs || [])
              .filter((j) => !["COMPLETE", "DELIVERED", "CANCELLED"].includes(j.status))
              .map((j) => (
                <li
                  key={j.id}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-950/50 p-3"
                >
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <Link
                        to={`/jobs/${j.id}`}
                        className="font-mono text-sm font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
                      >
                        {j.jobNumber}
                      </Link>
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-0.5">{j.customer?.name}</p>
                      <JobDeviceSummary device={j.device} className="mt-1" />
                      {j.assignedTechnician?.name && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-500 mt-0.5">
                          Assigned: {j.assignedTechnician.name}
                        </p>
                      )}
                      <span
                        className={`inline-flex mt-1.5 px-2 py-0.5 rounded-full text-xs ${statusBadgeClass(j.status)}`}
                        title={statusDescription(j.status)}
                      >
                        {statusLabel(j.status)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 shrink-0">
                      {TECH_QUICK_STATUSES.map((s) => (
                        <button
                          key={s.value}
                          type="button"
                          disabled={j.status === s.value}
                          title={s.description}
                          onClick={() => handleTechQuickStatus(j.id, s.value)}
                          className={`rounded-lg px-2.5 py-2 text-xs font-medium touch-manipulation min-h-[40px] sm:min-h-0 border transition-colors disabled:opacity-55 disabled:cursor-not-allowed ${
                            j.status === s.value
                              ? "border-sky-600 bg-sky-600 text-white"
                              : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sky-900 dark:text-sky-100 hover:bg-sky-50 dark:hover:bg-slate-800"
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
          </ul>
          {(data.recentJobs || []).filter((j) => !["COMPLETE", "DELIVERED", "CANCELLED"].includes(j.status)).length ===
            0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              None listed.{" "}
              <Link to="/jobs" className="text-cyan-600 dark:text-cyan-400 hover:underline font-medium">
                Jobs
              </Link>
            </p>
          )}
        </section>
      )}
      {showOpsShortcuts && (
        <section className="tech-glass p-4 sm:p-5 border border-cyan-500/15 dark:border-cyan-400/10">
          <h2 className="font-semibold text-cyan-900 dark:text-cyan-100 mb-3">{isAdmin ? "Operations" : "Shortcuts"}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              to="/jobs/new"
              className="rounded-xl border border-cyan-500/20 dark:border-cyan-400/20 bg-cyan-500/5 dark:bg-cyan-950/30 px-4 py-4 text-center text-sm font-medium text-cyan-900 dark:text-cyan-100 hover:bg-cyan-500/10 transition-colors touch-manipulation min-h-[44px] flex items-center justify-center"
            >
              New repair job
            </Link>
            <Link
              to="/jobs"
              className="rounded-xl border border-cyan-500/20 dark:border-cyan-400/20 bg-cyan-500/5 dark:bg-cyan-950/30 px-4 py-4 text-center text-sm font-medium text-cyan-900 dark:text-cyan-100 hover:bg-cyan-500/10 transition-colors touch-manipulation min-h-[44px] flex items-center justify-center"
            >
              Jobs queue
            </Link>
            <Link
              to="/customers"
              className="rounded-xl border border-cyan-500/20 dark:border-cyan-400/20 bg-cyan-500/5 dark:bg-cyan-950/30 px-4 py-4 text-center text-sm font-medium text-cyan-900 dark:text-cyan-100 hover:bg-cyan-500/10 transition-colors touch-manipulation min-h-[44px] flex items-center justify-center"
            >
              Customers
            </Link>
            {isAdmin && (
              <>
                <Link
                  to="/reports"
                  className="rounded-xl border border-violet-500/25 dark:border-violet-400/20 bg-violet-500/5 dark:bg-violet-950/25 px-4 py-4 text-center text-sm font-medium text-violet-900 dark:text-violet-100 hover:bg-violet-500/10 transition-colors touch-manipulation min-h-[44px] flex items-center justify-center"
                >
                  Reports & exports
                </Link>
                <Link
                  to="/activity"
                  className="rounded-xl border border-violet-500/25 dark:border-violet-400/20 bg-violet-500/5 dark:bg-violet-950/25 px-4 py-4 text-center text-sm font-medium text-violet-900 dark:text-violet-100 hover:bg-violet-500/10 transition-colors touch-manipulation min-h-[44px] flex items-center justify-center"
                >
                  Activity log
                </Link>
                <Link
                  to="/users"
                  className="rounded-xl border border-violet-500/25 dark:border-violet-400/20 bg-violet-500/5 dark:bg-violet-950/25 px-4 py-4 text-center text-sm font-medium text-violet-900 dark:text-violet-100 hover:bg-violet-500/10 transition-colors touch-manipulation min-h-[44px] flex items-center justify-center"
                >
                  Users & roles
                </Link>
              </>
            )}
          </div>
        </section>
      )}
      {showTodayIntakes && (
        <section className="tech-glass p-4 sm:p-5 border border-cyan-500/15 dark:border-cyan-400/10 print:hidden">
          <h2 className="font-semibold text-cyan-900 dark:text-cyan-100 mb-3">Today's intakes</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
                  <th className="pb-2 pr-4">Job</th>
                  <th className="pb-2 pr-4">Customer</th>
                  <JobDeviceTableHead />
                  <th className="pb-2 pr-4">Technician</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {(data.todayIntakes || []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-4 text-slate-500">
                      No jobs opened yet today.
                    </td>
                  </tr>
                ) : (
                  data.todayIntakes
                    .filter((j) => j.status !== "CANCELLED")
                    .map((j) => (
                    <tr key={j.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2 pr-4">
                        <Link to={`/jobs/${j.id}`} className="text-cyan-600 dark:text-cyan-400 font-mono hover:underline">
                          {j.jobNumber}
                        </Link>
                      </td>
                      <td className="py-2 pr-4">{j.customer?.name}</td>
                      <JobDeviceTableCells device={j.device} />
                      <td className="py-2 pr-4 text-slate-600 dark:text-slate-400">{j.assignedTechnician?.name || "—"}</td>
                      <td className="py-2">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs ${statusBadgeClass(j.status)}`}
                          title={statusDescription(j.status)}
                        >
                          {statusLabel(j.status)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => {
          const inner = (
            <>
              <p className="text-xs uppercase tracking-wide text-cyan-700/80 dark:text-cyan-300/80 font-medium">{c.label}</p>
              <p className="text-xl sm:text-2xl font-semibold mt-2 break-words tabular-nums text-slate-900 dark:text-slate-100 group-hover:text-cyan-900 dark:group-hover:text-cyan-100 transition-colors duration-300">
                {c.value}
              </p>
            </>
          );
          return c.to ? (
            <Link
              key={c.label}
              to={c.to}
              className="tech-glass p-4 sm:p-5 group block rounded-xl hover:ring-2 hover:ring-cyan-500/30 dark:hover:ring-cyan-400/25 transition-shadow touch-manipulation"
            >
              {inner}
            </Link>
          ) : (
            <div key={c.label} className="tech-glass p-4 sm:p-5 group">
              {inner}
            </div>
          );
        })}
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <section className="tech-glass p-4 sm:p-5">
          <h2 className="font-semibold mb-3 text-cyan-900 dark:text-cyan-100">
            {isTechScope ? "Assignments" : "Technician workload"}
          </h2>
          <ul className="space-y-2 text-sm">
            {data.technicianPerformance?.length ? (
              data.technicianPerformance.map((t) => (
                <li key={t.technicianId} className="flex justify-between">
                  <span>{t.name}</span>
                  <span className="text-slate-500">{t.jobsAssigned} jobs</span>
                </li>
              ))
            ) : (
              <li className="text-slate-500">None</li>
            )}
          </ul>
        </section>
        <section className="tech-glass p-4 sm:p-5">
          <h2 className="font-semibold mb-3 text-cyan-900 dark:text-cyan-100">Recent activity</h2>
          <ul className="space-y-2 text-sm max-h-48 overflow-auto">
            {data.recentActivities?.map((a) => (
              <li key={a.id} className="border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="font-medium">{a.action}</span>
                {a.user && <span className="text-slate-500"> · {a.user}</span>}
                <span className="text-slate-400 text-xs block">{new Date(a.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
        <section className="tech-glass p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
            <h2 className="font-semibold text-cyan-900 dark:text-cyan-100">
              Recent jobs
            </h2>
          <Link
            to="/jobs"
            className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline shrink-0 inline-flex items-center min-h-[44px] sm:min-h-0 py-1 touch-manipulation"
          >
            View all
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
                <th className="pb-2 pr-4">Job</th>
                <th className="pb-2 pr-4">Customer</th>
                <JobDeviceTableHead />
                {!isTechScope && <th className="pb-2 pr-4">Technician</th>}
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.recentJobs
                ?.filter((j) => j.status !== "CANCELLED")
                .map((j) => (
                <tr key={j.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-2 pr-4">
                    <Link to={`/jobs/${j.id}`} className="text-cyan-600 dark:text-cyan-400 font-mono hover:underline">
                      {j.jobNumber}
                    </Link>
                  </td>
                  <td className="py-2 pr-4">{j.customer?.name}</td>
                  <JobDeviceTableCells device={j.device} />
                  {!isTechScope && (
                    <td className="py-2 pr-4 text-slate-600 dark:text-slate-400 text-xs">{j.assignedTechnician?.name || "—"}</td>
                  )}
                  <td className="py-2">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs ${statusBadgeClass(j.status)}`}
                      title={statusDescription(j.status)}
                    >
                      {statusLabel(j.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
