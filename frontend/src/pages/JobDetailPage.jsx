import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { api, downloadFile } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { useOutbox } from "../lib/outbox.jsx";
import * as idb from "../lib/offlineDb.js";
import { JobDeviceDetailGrid } from "../components/JobDeviceTableCells.jsx";
import { NOTIFICATIONS_REFRESH_EVENT } from "../lib/notifications.jsx";
import {
  RECEPTION_STATUS_SELECT,
  TECH_QUICK_STATUSES,
  statusBadgeClass,
  statusDescription,
  statusLabel,
} from "../lib/status.js";

export default function JobDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const nav = useNavigate();
  const { user } = useAuth();
  const { enqueuePatchJobStatus } = useOutbox();
  const [job, setJob] = useState(null);
  const [err, setErr] = useState("");
  const [jobFromCache, setJobFromCache] = useState(false);
  const [status, setStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [collectorName, setCollectorName] = useState("");
  const [collectorPhone, setCollectorPhone] = useState("");
  const [collectionSig, setCollectionSig] = useState("");
  const [intakeBanner, setIntakeBanner] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("Cash");
  const [msg, setMsg] = useState("");
  const [techs, setTechs] = useState([]);
  const [custForm, setCustForm] = useState({ name: "", phone: "", email: "", notes: "" });
  const [jobDesk, setJobDesk] = useState({
    problemDescription: "",
    laborCost: "",
    partsCost: "",
    assignedTechnicianId: "",
  });

  const load = useCallback(async () => {
    setErr("");
    if (!navigator.onLine) {
      const cached = await idb.getJobDetailCache(id);
      if (cached) {
        applyJobToState(cached);
        setJobFromCache(true);
        return;
      }
      setJob(null);
      setJobFromCache(false);
      setErr("Offline. Open this job online once to save it on this device.");
      return;
    }
    setJobFromCache(false);
    try {
      const j = await api(`/jobs/${id}`);
      applyJobToState(j);
      await idb.putJobDetailCache(j);
    } catch (e) {
      const cached = await idb.getJobDetailCache(id);
      if (cached) {
        applyJobToState(cached);
        setJobFromCache(true);
        setErr("");
      } else {
        setErr(e.message);
      }
    }
  }, [id]);

  function applyJobToState(j) {
    setJob(j);
    setStatus(j.status);
    setCustForm({
      name: j.customer?.name || "",
      phone: j.customer?.phone || "",
      email: j.customer?.email || "",
      notes: j.customer?.notes || "",
    });
    setJobDesk({
      problemDescription: j.problemDescription || "",
      laborCost: String(j.laborCost ?? ""),
      partsCost: String(j.partsCost ?? ""),
      assignedTechnicianId: j.assignedTechnicianId || "",
    });
    if (j.status === "COMPLETE") {
      setCollectorName(j.customer?.name || "");
      setCollectorPhone(j.customer?.phone || "");
      setCollectionSig("");
    }
  }

  useEffect(() => {
    load();
    const onUp = () => load();
    window.addEventListener("online", onUp);
    return () => window.removeEventListener("online", onUp);
  }, [load]);

  useEffect(() => {
    if (location.state?.intakeHighlight) setIntakeBanner(true);
  }, [location.state?.intakeHighlight]);

  const canReceptionDesk = user?.role === "ADMIN" || user?.role === "RECEPTION";

  useEffect(() => {
    if (!canReceptionDesk) return;
    api("/team/technicians")
      .then(setTechs)
      .catch(() => setTechs([]));
  }, [canReceptionDesk]);

  async function quickSetStatus(next) {
    setMsg("");
    setErr("");
    if (!navigator.onLine) {
      try {
        await enqueuePatchJobStatus({ jobId: id, status: next, notes: statusNote });
        setStatusNote("");
        setMsg("Queued. Sync when online.");
        setJob((prev) => {
          if (!prev) return prev;
          const updated = { ...prev, status: next };
          idb.putJobDetailCache(updated);
          return updated;
        });
        setStatus(next);
      } catch (e) {
        setErr(e.message || "Could not queue status update");
      }
      return;
    }
    try {
      await api(`/jobs/${id}/status`, { method: "PATCH", body: { status: next, notes: statusNote || undefined } });
      setStatusNote("");
      setMsg("Status updated");
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function confirmPickup(e) {
    e.preventDefault();
    if (!navigator.onLine) {
      setErr("Internet required.");
      return;
    }
    setMsg("");
    setErr("");
    const cn = collectorName.trim();
    const cp = collectorPhone.trim();
    if (!cn || !cp) {
      setErr("Collector name and phone required.");
      return;
    }
    try {
      const updated = await api(`/jobs/${id}/status`, {
        method: "PATCH",
        body: {
          status: "DELIVERED",
          notes: statusNote || undefined,
          collectedByName: cn,
          collectedByPhone: cp,
          collectionSignature: collectionSig.trim() || undefined,
        },
      });
      setStatusNote("");
      setMsg("Delivered.");
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function cancelRepair() {
    if (
      !window.confirm(
        "Cancel this job? The customer record stays in the system; the job will be removed from the dashboard and active job lists.",
      )
    ) {
      return;
    }
    setMsg("");
    setErr("");
    if (!navigator.onLine) {
      try {
        await enqueuePatchJobStatus({ jobId: id, status: "CANCELLED", notes: "Cancelled" });
        setMsg("Cancellation queued. Sync when online.");
        nav("/jobs");
        return;
      } catch (e) {
        setErr(e.message || "Could not queue cancellation");
        return;
      }
    }
    try {
      await api(`/jobs/${id}/status`, { method: "PATCH", body: { status: "CANCELLED", notes: "Cancelled" } });
      window.dispatchEvent(new Event(NOTIFICATIONS_REFRESH_EVENT));
      nav("/jobs");
    } catch (e) {
      setErr(e.message);
    }
  }

  async function saveStatus(e) {
    e.preventDefault();
    if (!navigator.onLine) {
      setErr("Internet required.");
      return;
    }
    setMsg("");
    try {
      await api(`/jobs/${id}/status`, { method: "PATCH", body: { status, notes: statusNote } });
      setStatusNote("");
      setMsg("Status updated");
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function addPayment(e) {
    e.preventDefault();
    if (!navigator.onLine) {
      setErr("Internet required.");
      return;
    }
    setMsg("");
    try {
      await api("/payments", { method: "POST", body: { jobId: id, amount: payAmount, method: payMethod } });
      setPayAmount("");
      setMsg("Payment recorded");
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function sendReminder() {
    if (!navigator.onLine) {
      setErr("Internet required.");
      return;
    }
    setMsg("");
    try {
      await api(`/jobs/${id}/reminder`, { method: "POST", body: {} });
      setMsg("Reminder sent.");
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function saveCustomer(e) {
    e.preventDefault();
    if (!navigator.onLine) {
      setErr("Internet required.");
      return;
    }
    setMsg("");
    setErr("");
    try {
      await api(`/customers/${job.customer.id}`, {
        method: "PATCH",
        body: {
          name: custForm.name,
          phone: custForm.phone,
          email: custForm.email || null,
          notes: custForm.notes || null,
        },
      });
      setMsg("Customer updated");
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function saveJobDesk(e) {
    e.preventDefault();
    if (!navigator.onLine) {
      setErr("Internet required.");
      return;
    }
    setMsg("");
    setErr("");
    const body = {};
    if (user?.role === "ADMIN") {
      body.problemDescription = jobDesk.problemDescription;
      body.laborCost = jobDesk.laborCost;
      body.partsCost = jobDesk.partsCost;
      body.assignedTechnicianId = jobDesk.assignedTechnicianId || null;
    } else if (user?.role === "RECEPTION") {
      body.problemDescription = jobDesk.problemDescription;
      body.assignedTechnicianId = jobDesk.assignedTechnicianId || null;
    } else {
      return;
    }
    try {
      await api(`/jobs/${id}`, { method: "PATCH", body });
      setMsg("Job details saved");
      window.dispatchEvent(new Event(NOTIFICATIONS_REFRESH_EVENT));
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function saveQuote(e) {
    e.preventDefault();
    if (!navigator.onLine) {
      setErr("Internet required.");
      return;
    }
    setMsg("");
    setErr("");
    try {
      await api(`/jobs/${id}`, {
        method: "PATCH",
        body: { laborCost: jobDesk.laborCost, partsCost: jobDesk.partsCost },
      });
      setMsg("Quote saved");
      load();
    } catch (ex) {
      setErr(ex.message);
    }
  }

  function printReceipt() {
    window.print();
  }

  async function downloadInvoicePdf() {
    if (!job) return;
    if (!navigator.onLine) {
      setErr("Internet required.");
      return;
    }
    setMsg("");
    setErr("");
    try {
      await downloadFile(`/jobs/${job.id}/invoice`, job.jobNumber);
      setMsg("PDF downloaded");
    } catch (e) {
      setErr(e.message || "Download failed");
    }
  }

  if (err && !job) return <p className="text-red-600 dark:text-red-400">{err}</p>;
  if (!job) return <p className="text-slate-500">Loading…</p>;

  const total = Number(job.laborCost) + Number(job.partsCost);
  const paid = (job.payments || []).reduce((s, p) => s + Number(p.amount), 0);

  const isAssignedTech = user?.role === "TECHNICIAN" && job.assignedTechnicianId === user?.id;
  const isAdmin = user?.role === "ADMIN";
  const canEditQuote = isAdmin || isAssignedTech;
  const canUpdateStatus = user?.role === "ADMIN" || user?.role === "RECEPTION" || isAssignedTech;
  const techWorkshopOpen = isAssignedTech && !["COMPLETE", "DELIVERED", "CANCELLED"].includes(job.status);
  const canDeskStatusForm =
    canUpdateStatus &&
    (user?.role === "ADMIN" || user?.role === "RECEPTION") &&
    !isAssignedTech &&
    !["DELIVERED", "CANCELLED"].includes(job.status);
  const canPay = user?.role === "RECEPTION" || user?.role === "ADMIN";
  const canSendReminder = canPay || isAssignedTech;
  const canEditCustomer = user?.role === "ADMIN" || user?.role === "RECEPTION" || isAssignedTech;

  return (
    <div className="space-y-8">
      {!navigator.onLine && job && (
        <p className="rounded-xl border border-amber-300/80 bg-amber-50/90 dark:border-amber-800/60 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-950 dark:text-amber-100 print:hidden">
          Offline. Workshop status buttons queue locally; desk actions require a connection. Sync when online.
        </p>
      )}
      {jobFromCache && navigator.onLine && (
        <p className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-900/60 px-4 py-3 text-sm text-slate-700 dark:text-slate-300 print:hidden">
          Cached copy (server unavailable). Reconnect to refresh.
        </p>
      )}
      {intakeBanner && (
        <div
          className="rounded-xl border border-emerald-300/80 bg-emerald-50/90 dark:border-emerald-800/60 dark:bg-emerald-950/40 px-4 py-3 text-sm text-emerald-950 dark:text-emerald-100 print:hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          role="status"
        >
          <p>
            <span className="font-semibold">Job created.</span> Status: Pending.
          </p>
          <button
            type="button"
            className="shrink-0 rounded-lg bg-emerald-700 text-white px-3 py-2 text-sm font-medium touch-manipulation min-h-[44px] sm:min-h-0"
            onClick={() => {
              setIntakeBanner(false);
              nav(`/jobs/${id}`, { replace: true });
            }}
          >
            Dismiss
          </button>
        </div>
      )}
      <div className="flex flex-col gap-3 print:hidden">
        <h1 className="text-2xl font-bold font-mono text-sky-700 dark:text-sky-300">{job.jobNumber}</h1>
        <JobDeviceDetailGrid device={job.device} valueClassName="font-semibold text-lg text-slate-900 dark:text-slate-100" />
        <p className="text-slate-600 dark:text-slate-300">
          <span className="font-medium text-slate-800 dark:text-slate-200">{job.customer.name}</span>
          <span className="text-slate-400 dark:text-slate-500"> · </span>
          {job.customer.phone}
        </p>
        {canReceptionDesk && (
          <p className="print:hidden">
            <Link
              to={`/customers/${job.customer.id}/new-job`}
              className="text-sm font-medium text-cyan-600 dark:text-cyan-400 hover:underline touch-manipulation"
            >
              New job (same customer)
            </Link>
          </p>
        )}
        {job.assignedTechnician && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Assigned: <span className="font-medium text-slate-700 dark:text-slate-300">{job.assignedTechnician.name}</span>
          </p>
        )}
        <span
          className={`inline-flex w-fit px-2 py-0.5 rounded-full text-xs ${statusBadgeClass(job.status)}`}
          title={statusDescription(job.status)}
        >
          {statusLabel(job.status)}
        </span>
        {msg && <p className="text-sm text-emerald-600 dark:text-emerald-400">{msg}</p>}
        {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
      </div>

      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 print:hidden">
        <h2 className="font-semibold mb-2">Problem</h2>
        <p className="text-sm whitespace-pre-wrap">{job.problemDescription}</p>
      </section>

      {canEditCustomer && (
        <form
          onSubmit={saveCustomer}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 space-y-3 print:hidden"
        >
          <h2 className="font-semibold">Customer contact</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isAssignedTech ? "Assigned jobs only." : "Keep phone accurate for SMS."}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Name</label>
              <input
                required
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                value={custForm.name}
                onChange={(e) => setCustForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Phone</label>
              <input
                required
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                value={custForm.phone}
                onChange={(e) => setCustForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-slate-500 block mb-1">Email</label>
              <input
                type="email"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                value={custForm.email}
                onChange={(e) => setCustForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-slate-500 block mb-1">Notes</label>
              <textarea
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm min-h-[72px]"
                value={custForm.notes}
                onChange={(e) => setCustForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full sm:w-auto rounded-lg bg-sky-600 text-white px-4 py-3 sm:py-2 text-sm font-medium touch-manipulation min-h-[44px] sm:min-h-0"
          >
            Save customer
          </button>
        </form>
      )}

      {canReceptionDesk && (
        <form
          onSubmit={saveJobDesk}
          className="rounded-xl border border-cyan-200/50 dark:border-cyan-800/50 bg-cyan-50/40 dark:bg-slate-900/60 p-4 space-y-3 print:hidden"
        >
          <h2 className="font-semibold text-cyan-900 dark:text-cyan-100">{isAdmin ? "Job & quote" : "Job details"}</h2>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Problem description</label>
            <textarea
              required
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm min-h-[96px]"
              value={jobDesk.problemDescription}
              onChange={(e) => setJobDesk((d) => ({ ...d, problemDescription: e.target.value }))}
            />
          </div>
          {isAdmin && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Labor (TZS)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  value={jobDesk.laborCost}
                  onChange={(e) => setJobDesk((d) => ({ ...d, laborCost: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Parts (TZS)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  value={jobDesk.partsCost}
                  onChange={(e) => setJobDesk((d) => ({ ...d, partsCost: e.target.value }))}
                />
              </div>
            </div>
          )}
          <div>
            <label className="text-xs text-slate-500 block mb-1">Assigned technician</label>
            <select
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              value={jobDesk.assignedTechnicianId}
              onChange={(e) => setJobDesk((d) => ({ ...d, assignedTechnicianId: e.target.value }))}
            >
              <option value="">— Unassigned —</option>
              {techs.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="w-full sm:w-auto rounded-lg bg-cyan-700 dark:bg-cyan-600 text-white px-4 py-3 sm:py-2 text-sm font-medium touch-manipulation min-h-[44px] sm:min-h-0"
          >
            {isAdmin ? "Save job & quote" : "Save job details"}
          </button>
        </form>
      )}

      {canEditQuote && !isAdmin && (
        <form
          onSubmit={saveQuote}
          className="rounded-xl border border-violet-200/50 dark:border-violet-800/50 bg-violet-50/40 dark:bg-slate-900/60 p-4 space-y-3 print:hidden"
        >
          <h2 className="font-semibold text-violet-900 dark:text-violet-100">Quote (TZS)</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">Labor and parts are set by workshop staff.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Labor (TZS)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                value={jobDesk.laborCost}
                onChange={(e) => setJobDesk((d) => ({ ...d, laborCost: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Parts (TZS)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                value={jobDesk.partsCost}
                onChange={(e) => setJobDesk((d) => ({ ...d, partsCost: e.target.value }))}
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full sm:w-auto rounded-lg bg-violet-700 dark:bg-violet-600 text-white px-4 py-3 sm:py-2 text-sm font-medium touch-manipulation min-h-[44px] sm:min-h-0"
          >
            Save quote
          </button>
        </form>
      )}

      {techWorkshopOpen && (
        <section className="rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50/50 dark:bg-slate-900/60 p-4 space-y-3 print:hidden">
          <h2 className="font-semibold text-sky-900 dark:text-sky-100">Workshop progress</h2>
          <div className="flex flex-wrap gap-2">
            {TECH_QUICK_STATUSES.map((s) => (
              <button
                key={s.value}
                type="button"
                title={s.description}
                disabled={job.status === s.value}
                onClick={() => quickSetStatus(s.value)}
                className={`rounded-lg px-3 py-2.5 text-sm font-medium touch-manipulation min-h-[44px] sm:min-h-0 border transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                  job.status === s.value
                    ? "border-sky-600 bg-sky-600 text-white"
                    : "border-sky-300 dark:border-sky-700 bg-white dark:bg-slate-950 text-sky-900 dark:text-sky-100 hover:bg-sky-100 dark:hover:bg-slate-800"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Status note (optional)</label>
            <input
              placeholder="Optional"
              className="w-full max-w-lg rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
            />
          </div>
        </section>
      )}

      {canReceptionDesk && job.status === "COMPLETE" && (
        <form
          onSubmit={confirmPickup}
          className="rounded-xl border border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-slate-900/60 p-4 space-y-3 print:hidden"
        >
          <h2 className="font-semibold text-emerald-900 dark:text-emerald-100">Customer pickup</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">Collector details required. Notifies technician and admins.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Collected by (name)</label>
              <input
                required
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                value={collectorName}
                onChange={(e) => setCollectorName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Collector phone</label>
              <input
                required
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                value={collectorPhone}
                onChange={(e) => setCollectorPhone(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Confirmation (optional)</label>
            <textarea
              placeholder="Signature or note"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm min-h-[72px]"
              value={collectionSig}
              onChange={(e) => setCollectionSig(e.target.value)}
              maxLength={12000}
            />
          </div>
          <button
            type="submit"
            className="w-full sm:w-auto rounded-lg bg-emerald-700 text-white px-4 py-3 sm:py-2 text-sm font-medium touch-manipulation min-h-[44px] sm:min-h-0"
          >
            Approve customer pickup
          </button>
        </form>
      )}

      {canReceptionDesk && !["DELIVERED", "CANCELLED"].includes(job.status) && (
        <div className="print:hidden rounded-xl border border-red-200/80 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-red-900/90 dark:text-red-100/90">
            Cancel if the repair will not proceed. Customer details remain saved.
          </p>
          <button
            type="button"
            onClick={cancelRepair}
            className="shrink-0 rounded-lg bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 text-sm font-semibold touch-manipulation min-h-[44px] sm:min-h-0"
          >
            Cancel job
          </button>
        </div>
      )}

      {canDeskStatusForm && (
        <form onSubmit={saveStatus} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 space-y-3 print:hidden">
          <h2 className="font-semibold">Status</h2>
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
            <div className="w-full lg:w-auto shrink-0">
              <label className="text-xs text-slate-500 block mb-1">Status</label>
              <select
                className="w-full lg:w-auto min-w-0 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2.5 lg:py-2 text-sm min-h-[44px] lg:min-h-0"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                aria-describedby="status-legend-hint"
              >
                {RECEPTION_STATUS_SELECT.map((s) => (
                  <option key={s.value} value={s.value} title={s.description}>
                    {s.label}
                  </option>
                ))}
              </select>
              <p id="status-legend-hint" className="text-[11px] text-slate-500 dark:text-slate-500 mt-1 max-w-md">
                Delivered: use <strong className="font-medium">Customer pickup</strong> above.
              </p>
            </div>
            <input
              placeholder="Note (optional)"
              className="w-full lg:flex-1 lg:min-w-[160px] rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2.5 lg:py-2 text-sm min-h-[44px] lg:min-h-0"
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
            />
            <button
              type="submit"
              className="w-full lg:w-auto rounded-lg bg-sky-600 text-white px-4 py-3 lg:py-2 text-sm font-medium touch-manipulation min-h-[44px] lg:min-h-0 shrink-0"
            >
              Save
            </button>
          </div>
        </form>
      )}

      {(canPay || canSendReminder) && (
        <div
          className={`grid gap-6 print:hidden ${canPay && canSendReminder ? "lg:grid-cols-2" : ""}`}
        >
          {canPay && (
            <form onSubmit={addPayment} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 space-y-3">
              <h2 className="font-semibold">Record payment</h2>
              <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-end">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  placeholder="Amount TZS"
                  className="w-full lg:flex-1 lg:min-w-[120px] rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2.5 lg:py-2 text-sm min-h-[44px] lg:min-h-0"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
                <select
                  className="w-full lg:w-auto rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2.5 lg:py-2 text-sm min-h-[44px] lg:min-h-0"
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                >
                  <option>Cash</option>
                  <option>Mobile money</option>
                  <option>Card</option>
                  <option>Bank</option>
                </select>
                <button
                  type="submit"
                  className="w-full lg:w-auto rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 px-4 py-3 lg:py-2 text-sm touch-manipulation min-h-[44px] lg:min-h-0 shrink-0"
                >
                  Add
                </button>
              </div>
            </form>
          )}
          {canSendReminder && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 space-y-2">
              <h2 className="font-semibold">SMS</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Uses the workshop SMS template.</p>
              <button
                type="button"
                onClick={sendReminder}
                className="w-full lg:w-auto rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-3 lg:py-2 text-sm touch-manipulation min-h-[44px] lg:min-h-0"
              >
                Send collection reminder
              </button>
            </div>
          )}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 print:hidden">
        <h2 className="font-semibold mb-2">Costs</h2>
        <p className="text-sm">
          Labor: TZS {Number(job.laborCost).toLocaleString()} · Parts: TZS {Number(job.partsCost).toLocaleString()}
        </p>
        <p className="text-sm font-medium mt-1">Quoted total: TZS {total.toLocaleString()}</p>
        <p className="text-sm text-slate-600 dark:text-slate-400">Paid: TZS {paid.toLocaleString()}</p>
      </section>

      <section id="receipt" className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-6 bg-white text-slate-900 print:border-none print:shadow-none">
        <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-start">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-sky-600 font-bold">BIOSFIX TECHNOLOGY</p>
            <h3 className="text-lg font-bold">Workshop receipt</h3>
          </div>
          <div className="print:hidden flex flex-col gap-2 w-full lg:w-auto lg:flex-row lg:flex-wrap lg:justify-end">
            <button
              type="button"
              onClick={downloadInvoicePdf}
              className="w-full lg:w-auto rounded-lg bg-sky-600 text-white px-3 py-3 lg:py-2 text-sm font-medium touch-manipulation min-h-[44px] lg:min-h-0"
            >
              Download PDF
            </button>
            <button
              type="button"
              onClick={printReceipt}
              className="w-full lg:w-auto rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-3 lg:py-2 text-sm touch-manipulation min-h-[44px] lg:min-h-0"
            >
              Print
            </button>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-1 min-[380px]:grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-slate-500">Job</dt>
          <dd className="font-mono font-medium">{job.jobNumber}</dd>
          <dt className="text-slate-500">Customer</dt>
          <dd>{job.customer.name}</dd>
          <dt className="text-slate-500">Phone</dt>
          <dd>{job.customer.phone}</dd>
          <dt className="text-slate-500">Brand</dt>
          <dd>{job.device.brand?.trim() || "—"}</dd>
          <dt className="text-slate-500">Model</dt>
          <dd>{job.device.model?.trim() || "—"}</dd>
          <dt className="text-slate-500">Serial Number</dt>
          <dd>{job.device.serialNumber?.trim() || "—"}</dd>
          <dt className="text-slate-500">Status</dt>
          <dd>{statusLabel(job.status)}</dd>
          {job.status === "DELIVERED" && job.collectedByName && (
            <>
              <dt className="text-slate-500">Collected by</dt>
              <dd>
                {job.collectedByName}
                {job.collectedByPhone ? ` · ${job.collectedByPhone}` : ""}
              </dd>
            </>
          )}
          {job.status === "DELIVERED" && job.collectionSignature && (
            <>
              <dt className="text-slate-500">Signature / confirmation</dt>
              <dd className="whitespace-pre-wrap text-xs max-w-md">{job.collectionSignature}</dd>
            </>
          )}
          <dt className="text-slate-500">Total</dt>
          <dd>TZS {total.toLocaleString()}</dd>
          <dt className="text-slate-500">Paid</dt>
          <dd>TZS {paid.toLocaleString()}</dd>
        </dl>
        <p className="text-xs text-slate-500 mt-6">Thank you.</p>
      </section>

      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 print:hidden">
        <h2 className="font-semibold mb-2">Repair timeline</h2>
        <ul className="text-sm space-y-2">
          {(job.repairs || []).map((r) => (
            <li key={r.id} className="border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="font-mono text-xs text-slate-500">{new Date(r.createdAt).toLocaleString()}</span>{" "}
              {r.fromStatus ? `${statusLabel(r.fromStatus)} → ` : ""}
              <strong>{statusLabel(r.toStatus)}</strong>
              {r.technician && <span className="text-slate-500"> · {r.technician.name}</span>}
              {r.notes && <p className="text-slate-600 mt-1">{r.notes}</p>}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 print:hidden">
        <h2 className="font-semibold mb-2">SMS log</h2>
        <ul className="text-xs space-y-1 max-h-40 overflow-auto font-mono text-slate-600 dark:text-slate-400">
          {(job.smsLogs || []).map((s) => (
            <li key={s.id}>
              {s.category} · {s.status} · {s.message.slice(0, 80)}…
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
