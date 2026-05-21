import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, downloadFile } from "../lib/api.js";
import { statusBadgeClass, statusDescription, statusLabel } from "../lib/status.js";

const TZS = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const PCT = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });

function toYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function parseYMD(s) {
  const [y, m, d] = (s || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function daysInclusive(from, to) {
  const a = parseYMD(from);
  const b = parseYMD(to);
  if (!a || !b) return 0;
  return Math.floor((b - a) / 86400000) + 1;
}
function formatLong(date) {
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

const PRESETS = [
  {
    id: "today",
    label: "Today",
    range: () => {
      const d = new Date();
      return [d, d];
    },
  },
  {
    id: "yesterday",
    label: "Yesterday",
    range: () => {
      const d = addDays(new Date(), -1);
      return [d, d];
    },
  },
  {
    id: "7d",
    label: "Last 7 days",
    range: () => {
      const end = new Date();
      return [addDays(end, -6), end];
    },
  },
  {
    id: "30d",
    label: "Last 30 days",
    range: () => {
      const end = new Date();
      return [addDays(end, -29), end];
    },
  },
  {
    id: "mtd",
    label: "This month",
    range: () => {
      const d = new Date();
      return [startOfMonth(d), d];
    },
  },
  {
    id: "lastm",
    label: "Last month",
    range: () => {
      const now = new Date();
      const firstThis = startOfMonth(now);
      const lastPrev = addDays(firstThis, -1);
      return [startOfMonth(lastPrev), endOfMonth(lastPrev)];
    },
  },
  {
    id: "ytd",
    label: "Year to date",
    range: () => {
      const d = new Date();
      return [new Date(d.getFullYear(), 0, 1), d];
    },
  },
];

function detectPreset(from, to) {
  for (const p of PRESETS) {
    const [a, b] = p.range();
    if (toYMD(a) === from && toYMD(b) === to) return p.id;
  }
  return "custom";
}

function previousRange(from, to) {
  const a = parseYMD(from);
  const b = parseYMD(to);
  if (!a || !b) return null;
  const days = Math.floor((b - a) / 86400000) + 1;
  const prevEnd = addDays(a, -1);
  const prevStart = addDays(prevEnd, -(days - 1));
  return { from: toYMD(prevStart), to: toYMD(prevEnd) };
}

function pctChange(curr, prev) {
  if (prev == null || prev === 0) return curr > 0 ? 1 : 0;
  return (curr - prev) / Math.abs(prev);
}

function DeltaChip({ value, invert = false }) {
  if (value == null || !isFinite(value)) return null;
  const up = value > 0.0005;
  const down = value < -0.0005;
  const flat = !up && !down;
  const good = invert ? down : up;
  const bad = invert ? up : down;
  const color = flat
    ? "text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700"
    : good
      ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60"
      : bad
        ? "text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/60"
        : "text-slate-500";
  const arrow = flat ? "—" : up ? "▲" : "▼";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium tabular-nums ${color}`}>
      <span aria-hidden>{arrow}</span>
      <span>{PCT.format(Math.abs(value))}</span>
    </span>
  );
}

function KpiCard({ label, value, sub, delta, deltaInvert, accent = "cyan" }) {
  const accents = {
    cyan: "from-cyan-500/10 to-teal-500/5 border-cyan-500/20 dark:border-cyan-400/15",
    emerald: "from-emerald-500/10 to-teal-500/5 border-emerald-500/20 dark:border-emerald-400/15",
    indigo: "from-indigo-500/10 to-violet-500/5 border-indigo-500/20 dark:border-indigo-400/15",
    amber: "from-amber-500/10 to-orange-500/5 border-amber-500/20 dark:border-amber-400/15",
  };
  return (
    <div
      className={`tech-glass relative overflow-hidden p-4 sm:p-5 bg-gradient-to-br ${accents[accent] || accents.cyan}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <div className="mt-2 flex items-baseline gap-2 flex-wrap">
        <p className="text-2xl sm:text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-50 break-words">
          {value}
        </p>
        {delta != null && <DeltaChip value={delta} invert={deltaInvert} />}
      </div>
      {sub && <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{sub}</p>}
    </div>
  );
}

function StatRow({ label, value, share, badgeClass, hint }) {
  const pct = Math.max(0, Math.min(1, share || 0));
  return (
    <li className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span
          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${badgeClass || "bg-slate-100 dark:bg-slate-800"}`}
          title={hint || ""}
        >
          {label}
        </span>
        <span className="text-sm tabular-nums font-medium text-slate-800 dark:text-slate-100">
          {value}{" "}
          <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">({PCT.format(pct)})</span>
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-200/70 dark:bg-slate-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-500"
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </li>
  );
}

function TechRow({ rank, name, amount, count, share }) {
  const pct = Math.max(0, Math.min(1, share || 0));
  return (
    <li className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-600/10 text-[11px] font-bold text-cyan-800 dark:bg-cyan-400/15 dark:text-cyan-200">
            {rank}
          </span>
          <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{name}</span>
        </div>
        <div className="text-right">
          <div className="text-sm tabular-nums font-semibold text-slate-900 dark:text-slate-50">
            TZS {TZS.format(amount)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {count} payment{count === 1 ? "" : "s"} · {PCT.format(pct)}
          </div>
        </div>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-200/70 dark:bg-slate-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500"
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </li>
  );
}

function SkeletonBlock({ className = "" }) {
  return <div className={`animate-pulse rounded bg-slate-200/70 dark:bg-slate-800/60 ${className}`} />;
}

export default function ReportsPage() {
  const today = new Date();
  const [from, setFrom] = useState(toYMD(startOfMonth(today)));
  const [to, setTo] = useState(toYMD(today));
  const [summary, setSummary] = useState(null);
  const [prevSummary, setPrevSummary] = useState(null);
  const [compare, setCompare] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatedAt, setGeneratedAt] = useState(null);
  const abortRef = useRef(null);

  const presetId = useMemo(() => detectPreset(from, to), [from, to]);
  const rangeDays = daysInclusive(from, to);
  const invalidRange = useMemo(() => {
    const a = parseYMD(from);
    const b = parseYMD(to);
    if (!a || !b) return "Pick a valid From and To date.";
    if (a > b) return "From date must be before or equal to To date.";
    return "";
  }, [from, to]);

  const q = useMemo(() => `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, [from, to]);

  const load = useCallback(async () => {
    if (invalidRange) return;
    setErr("");
    setLoading(true);
    abortRef.current?.abort?.();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const tasks = [api(`/reports/summary${q}`)];
      let prevQ = null;
      if (compare) {
        const prev = previousRange(from, to);
        if (prev) {
          prevQ = `?from=${encodeURIComponent(prev.from)}&to=${encodeURIComponent(prev.to)}`;
          tasks.push(api(`/reports/summary${prevQ}`));
        }
      }
      const [curr, prev] = await Promise.all(tasks);
      if (ctrl.signal.aborted) return;
      setSummary(curr);
      setPrevSummary(prev || null);
      setGeneratedAt(new Date());
    } catch (e) {
      if (e?.name === "AbortError") return;
      setErr(e.message || "Could not load report");
      setSummary(null);
      setPrevSummary(null);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, [q, compare, from, to, invalidRange]);

  useEffect(() => {
    load();
    return () => abortRef.current?.abort?.();
  }, [load]);

  const applyPreset = (id) => {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    const [a, b] = p.range();
    setFrom(toYMD(a));
    setTo(toYMD(b));
  };

  // Derived KPIs
  const kpis = useMemo(() => {
    if (!summary) return null;
    const total = Number(summary.paymentsTotal || 0);
    const count = Number(summary.paymentCount || 0);
    const opened = Number(summary.jobsCreated || 0);
    const completed = Number(summary.completedInRange || 0);
    const avgTicket = count ? total / count : 0;
    const completionRate = opened ? completed / opened : 0;
    const cancelled = Number(summary.jobsByStatus?.CANCELLED || 0);
    const cancellationRate = opened ? cancelled / opened : 0;
    const paymentsPerJob = opened ? count / opened : 0;
    let prevK = null;
    if (prevSummary) {
      const pTotal = Number(prevSummary.paymentsTotal || 0);
      const pCount = Number(prevSummary.paymentCount || 0);
      const pOpened = Number(prevSummary.jobsCreated || 0);
      const pCompleted = Number(prevSummary.completedInRange || 0);
      prevK = {
        total: pTotal,
        count: pCount,
        opened: pOpened,
        completed: pCompleted,
        avgTicket: pCount ? pTotal / pCount : 0,
        completionRate: pOpened ? pCompleted / pOpened : 0,
      };
    }
    return {
      total,
      count,
      opened,
      completed,
      avgTicket,
      completionRate,
      cancellationRate,
      paymentsPerJob,
      prev: prevK,
    };
  }, [summary, prevSummary]);

  const statusBreakdown = useMemo(() => {
    if (!summary?.jobsByStatus) return [];
    const totalJobs = Object.values(summary.jobsByStatus).reduce((s, n) => s + Number(n || 0), 0);
    return Object.entries(summary.jobsByStatus)
      .map(([k, v]) => ({
        key: k,
        count: Number(v || 0),
        share: totalJobs ? Number(v) / totalJobs : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [summary]);

  const techLeaderboard = useMemo(() => {
    const rows = summary?.technicianRevenue || [];
    const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
    return rows
      .map((r) => ({ ...r, share: total ? Number(r.amount) / total : 0 }))
      .slice(0, 10);
  }, [summary]);

  const fromLong = parseYMD(from) ? formatLong(parseYMD(from)) : from;
  const toLong = parseYMD(to) ? formatLong(parseYMD(to)) : to;

  return (
    <div className="space-y-6">
      {/* ───── Header ───── */}
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">
            Reports
          </p>
          <h1 className="text-xl sm:text-2xl font-bold tech-heading-gradient">Workshop performance</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-slate-800 dark:text-slate-100">
              {fromLong} — {toLong}
            </span>
            <span aria-hidden className="text-slate-400">·</span>
            <span>{rangeDays} day{rangeDays === 1 ? "" : "s"}</span>
            {generatedAt && (
              <>
                <span aria-hidden className="text-slate-400">·</span>
                <span className="text-slate-500 dark:text-slate-400">
                  Generated {generatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button
            type="button"
            onClick={load}
            disabled={loading || !!invalidRange}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 sm:py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 touch-manipulation min-h-[44px] sm:min-h-0"
            aria-label="Refresh report"
          >
            <svg className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6M20 20v-6h-6M5 14a8 8 0 0014 4M19 10A8 8 0 005 6" />
            </svg>
            {loading ? "Loading…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 sm:py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 touch-manipulation min-h-[44px] sm:min-h-0"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 9V4h12v5M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z" />
            </svg>
            Print
          </button>
        </div>
      </header>

      {/* ───── Period controls ───── */}
      <section className="tech-glass p-4 sm:p-5 space-y-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Reporting period</h2>
          <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={compare}
              onChange={(e) => setCompare(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
            />
            Compare to previous period
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => {
            const active = presetId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium border touch-manipulation transition ${
                  active
                    ? "bg-cyan-600 text-white border-cyan-600 shadow-sm"
                    : "bg-white/60 dark:bg-slate-900/40 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-cyan-500/10 hover:border-cyan-500/40"
                }`}
              >
                {p.label}
              </button>
            );
          })}
          <span
            className={`ml-auto inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium border ${
              presetId === "custom"
                ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200"
                : "bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
            }`}
          >
            {presetId === "custom" ? "Custom range" : PRESETS.find((p) => p.id === presetId)?.label}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
          <div>
            <label htmlFor="rep-from" className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
              From
            </label>
            <input
              id="rep-from"
              type="date"
              max={to || undefined}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="rep-to" className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
              To
            </label>
            <input
              id="rep-to"
              type="date"
              min={from || undefined}
              max={toYMD(new Date())}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>
        {invalidRange && (
          <p className="text-xs text-red-600 dark:text-red-400">{invalidRange}</p>
        )}
      </section>

      {/* ───── Error ───── */}
      {err && (
        <div className="rounded-xl border border-red-300/60 dark:border-red-800/50 bg-red-50/80 dark:bg-red-950/30 text-red-900 dark:text-red-200 px-4 py-3 text-sm">
          {err}
        </div>
      )}

      {/* ───── KPI strip ───── */}
      <section aria-label="Headline metrics" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {loading && !summary ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="tech-glass p-4 sm:p-5 space-y-3">
              <SkeletonBlock className="h-3 w-1/2" />
              <SkeletonBlock className="h-7 w-2/3" />
              <SkeletonBlock className="h-3 w-2/5" />
            </div>
          ))
        ) : kpis ? (
          <>
            <KpiCard
              label="Revenue"
              value={`TZS ${TZS.format(kpis.total)}`}
              sub={`Avg ticket TZS ${TZS.format(kpis.avgTicket)}`}
              delta={compare && kpis.prev ? pctChange(kpis.total, kpis.prev.total) : null}
              accent="emerald"
            />
            <KpiCard
              label="Payments received"
              value={TZS.format(kpis.count)}
              sub={`${kpis.paymentsPerJob.toFixed(2)} per job opened`}
              delta={compare && kpis.prev ? pctChange(kpis.count, kpis.prev.count) : null}
              accent="cyan"
            />
            <KpiCard
              label="Jobs opened"
              value={TZS.format(kpis.opened)}
              sub={`${TZS.format(kpis.completed)} completed in period`}
              delta={compare && kpis.prev ? pctChange(kpis.opened, kpis.prev.opened) : null}
              accent="indigo"
            />
            <KpiCard
              label="Completion rate"
              value={PCT.format(kpis.completionRate)}
              sub={`${TZS.format(kpis.completed)} of ${TZS.format(kpis.opened)} jobs`}
              delta={
                compare && kpis.prev ? pctChange(kpis.completionRate, kpis.prev.completionRate) : null
              }
              accent="amber"
            />
          </>
        ) : null}
      </section>

      {/* ───── Quality strip ───── */}
      {kpis && (
        <section
          aria-label="Quality indicators"
          className="grid gap-3 grid-cols-2 lg:grid-cols-4 text-sm"
        >
          <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-white/60 dark:bg-slate-900/40 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Avg ticket
            </p>
            <p className="text-base font-semibold tabular-nums text-slate-900 dark:text-slate-50">
              TZS {TZS.format(kpis.avgTicket)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-white/60 dark:bg-slate-900/40 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Payments / job
            </p>
            <p className="text-base font-semibold tabular-nums text-slate-900 dark:text-slate-50">
              {kpis.paymentsPerJob.toFixed(2)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-white/60 dark:bg-slate-900/40 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Completion rate
            </p>
            <p className="text-base font-semibold tabular-nums text-slate-900 dark:text-slate-50">
              {PCT.format(kpis.completionRate)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-white/60 dark:bg-slate-900/40 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Cancellation rate
            </p>
            <p
              className={`text-base font-semibold tabular-nums ${
                kpis.cancellationRate > 0.1
                  ? "text-red-600 dark:text-red-400"
                  : "text-slate-900 dark:text-slate-50"
              }`}
            >
              {PCT.format(kpis.cancellationRate)}
            </p>
          </div>
        </section>
      )}

      {/* ───── Analysis grid ───── */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="tech-glass p-4 sm:p-5 space-y-4">
          <header className="flex items-baseline justify-between">
            <h2 className="font-semibold text-cyan-900 dark:text-cyan-100">Jobs by status</h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {statusBreakdown.reduce((s, x) => s + x.count, 0)} jobs opened
            </span>
          </header>
          {loading && !summary ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonBlock key={i} className="h-8" />
              ))}
            </div>
          ) : statusBreakdown.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No jobs opened in this period.</p>
          ) : (
            <ul className="space-y-3">
              {statusBreakdown.map((row) => (
                <StatRow
                  key={row.key}
                  label={statusLabel(row.key)}
                  value={row.count}
                  share={row.share}
                  badgeClass={statusBadgeClass(row.key)}
                  hint={statusDescription(row.key)}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="tech-glass p-4 sm:p-5 space-y-4">
          <header className="flex items-baseline justify-between">
            <h2 className="font-semibold text-cyan-900 dark:text-cyan-100">Top earners (technicians)</h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {techLeaderboard.length} {techLeaderboard.length === 1 ? "person" : "people"}
            </span>
          </header>
          {loading && !summary ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonBlock key={i} className="h-8" />
              ))}
            </div>
          ) : techLeaderboard.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No payments recorded in this period.</p>
          ) : (
            <ul className="space-y-3">
              {techLeaderboard.map((row, i) => (
                <TechRow
                  key={row.technicianId || row.name + i}
                  rank={i + 1}
                  name={row.name}
                  amount={Number(row.amount || 0)}
                  count={Number(row.count || 0)}
                  share={row.share}
                />
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ───── Export center ───── */}
      <section className="tech-glass p-4 sm:p-5 space-y-4 print:hidden">
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold text-cyan-900 dark:text-cyan-100">Export</h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Files cover {fromLong} → {toLong}
          </span>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            disabled={!!invalidRange}
            onClick={() =>
              downloadFile(`/reports/export/summary.pdf${q}`, `biosfix-summary-${from}_to_${to}`)
            }
            className="group text-left rounded-xl border border-cyan-500/30 dark:border-cyan-400/25 bg-gradient-to-br from-cyan-500/10 to-teal-500/5 p-4 hover:from-cyan-500/15 hover:to-teal-500/10 transition disabled:opacity-50 touch-manipulation"
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600 text-white">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
                </svg>
              </span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                Summary PDF
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
              Printable performance summary for sharing or filing.
            </p>
          </button>

          <button
            type="button"
            disabled={!!invalidRange}
            onClick={() => downloadFile(`/reports/export/jobs.csv${q}`, `biosfix-jobs-${from}_to_${to}`)}
            className="group text-left rounded-xl border border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-slate-900/40 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition disabled:opacity-50 touch-manipulation"
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 6h18M3 14h18M3 18h18" />
                </svg>
              </span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">Jobs CSV</span>
            </div>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
              Per-job rows: status, customer, device, costs, dates.
            </p>
          </button>

          <button
            type="button"
            disabled={!!invalidRange}
            onClick={() =>
              downloadFile(`/reports/export/payments.csv${q}`, `biosfix-payments-${from}_to_${to}`)
            }
            className="group text-left rounded-xl border border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-slate-900/40 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition disabled:opacity-50 touch-manipulation"
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-200">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V6m0 10v2m9-9a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                Payments CSV
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
              All payments with amount, method, recorder, and technician.
            </p>
          </button>

          <button
            type="button"
            disabled={!!invalidRange}
            onClick={() =>
              downloadFile(`/reports/export/customers.csv${q}`, `biosfix-customers-${from}_to_${to}`)
            }
            className="group text-left rounded-xl border border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-slate-900/40 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition disabled:opacity-50 touch-manipulation"
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-200">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M16 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                New customers CSV
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
              Customers registered in this period and their job counts.
            </p>
          </button>
        </div>
      </section>
    </div>
  );
}
