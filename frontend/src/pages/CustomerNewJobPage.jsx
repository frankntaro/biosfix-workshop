import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { LAPTOP_BRANDS } from "../lib/laptopBrands.js";
import { useOutbox } from "../lib/outbox.jsx";

export default function CustomerNewJobPage() {
  const { customerId } = useParams();
  const { user } = useAuth();
  const { enqueueCreateJob, online } = useOutbox();
  const nav = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [techs, setTechs] = useState([]);
  const [form, setForm] = useState({
    brand: "",
    model: "",
    serial: "",
    problem: "",
    assignedTechnicianId: "",
  });
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [brandIsOther, setBrandIsOther] = useState(false);

  const brandSelectValue = brandIsOther ? "Other" : LAPTOP_BRANDS.includes(form.brand) ? form.brand : "";

  useEffect(() => {
    if (user?.role === "ADMIN" || user?.role === "RECEPTION") {
      api("/team/technicians")
        .then(setTechs)
        .catch(() => setTechs([]));
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    setErr("");
    api(`/customers/${customerId}`)
      .then((c) => {
        if (!cancelled) setCustomer(c);
      })
      .catch(() => {
        if (!cancelled) setErr("Customer not found.");
      });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    if (!customer) return;
    const brandTrim = (form.brand || "").trim();
    if (brandIsOther) {
      if (!brandTrim) {
        setErr("Specify brand name.");
        return;
      }
    } else {
      if (!brandTrim || !LAPTOP_BRANDS.includes(form.brand)) {
        setErr("Select a brand.");
        return;
      }
    }
    setSaving(true);
    try {
      const body = {
        customerId: customer.id,
        device: {
          brand: brandTrim,
          model: form.model.trim(),
          serialNumber: form.serial?.trim() || undefined,
        },
        problemDescription: form.problem.trim(),
        assignedTechnicianId: form.assignedTechnicianId || undefined,
      };
      if (!navigator.onLine) {
        await enqueueCreateJob(body);
        nav("/jobs", { state: { offlineQueued: true } });
        return;
      }
      const job = await api("/jobs", { method: "POST", body });
      nav(`/jobs/${job.id}`, { state: { intakeHighlight: true } });
    } catch (ex) {
      setErr(ex.message || "Could not create job");
    } finally {
      setSaving(false);
    }
  }

  if (err && !customer) {
    return (
      <div className="max-w-2xl space-y-4">
        <p className="text-sm text-red-600 dark:text-red-400">{err}</p>
        <Link to="/customers" className="text-sm text-cyan-600 dark:text-cyan-400 font-medium hover:underline">
          Back to customers
        </Link>
      </div>
    );
  }

  if (!customer) {
    return <p className="text-sm text-slate-500 animate-pulse">Loading customer…</p>;
  }

  return (
    <div className="max-w-2xl space-y-6 w-full min-w-0">
      <div>
        <Link to="/customers" className="text-sm text-cyan-600 dark:text-cyan-400 font-medium hover:underline">
          ← Customers
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold mt-2">New job</h1>
      </div>
      <form onSubmit={submit} className="tech-glass space-y-6 p-4 sm:p-6">
        <fieldset className="space-y-3 rounded-xl border border-cyan-500/15 dark:border-cyan-400/10 bg-cyan-500/[0.04] dark:bg-slate-950/40 p-4">
          <legend className="text-sm font-semibold text-cyan-700 dark:text-cyan-300 px-1">Customer</legend>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{customer.name}</p>
          <p className="text-sm text-slate-600 dark:text-slate-400">{customer.phone}</p>
          {customer.email ? (
            <p className="text-xs text-slate-500 dark:text-slate-500">{customer.email}</p>
          ) : null}
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-cyan-700 dark:text-cyan-300">Device</legend>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="min-w-0">
              <label htmlFor="laptop-brand" className="text-xs text-slate-500 dark:text-slate-400 mb-1 block font-medium">
                Brand
              </label>
              <select
                id="laptop-brand"
                required={!brandIsOther}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                value={brandSelectValue}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "Other") {
                    setBrandIsOther(true);
                    setForm((f) => ({ ...f, brand: "" }));
                  } else if (v === "") {
                    setBrandIsOther(false);
                    setForm((f) => ({ ...f, brand: "" }));
                  } else {
                    setBrandIsOther(false);
                    setForm((f) => ({ ...f, brand: v }));
                  }
                }}
              >
                <option value="">— Select —</option>
                {LAPTOP_BRANDS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="min-w-0">
              <label htmlFor="laptop-model" className="text-xs text-slate-500 dark:text-slate-400 mb-1 block font-medium">
                Model
              </label>
              <input
                id="laptop-model"
                required
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                value={form.model}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="laptop-serial" className="text-xs text-slate-500 dark:text-slate-400 mb-1 block font-medium">
                Serial Number
              </label>
              <input
                id="laptop-serial"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                value={form.serial}
                onChange={(e) => setForm((f) => ({ ...f, serial: e.target.value }))}
              />
            </div>
          </div>
          {brandIsOther && (
            <div className="min-w-0">
              <label htmlFor="laptop-brand-other" className="text-xs text-slate-500 dark:text-slate-400 mb-1 block font-medium">
                Other brand
              </label>
              <input
                id="laptop-brand-other"
                required
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                value={form.brand}
                onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
              />
            </div>
          )}
        </fieldset>
        <div>
          <label className="block text-sm font-semibold text-cyan-700 dark:text-cyan-300 mb-1">Problem</label>
          <textarea
            required
            placeholder="Describe the problem"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm min-h-[96px]"
            value={form.problem}
            onChange={(e) => setForm((f) => ({ ...f, problem: e.target.value }))}
          />
        </div>
        {(user?.role === "ADMIN" || user?.role === "RECEPTION") && (
          <div>
            <label className="text-xs text-slate-500">Assign technician</label>
            <select
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              value={form.assignedTechnicianId}
              onChange={(e) => setForm((f) => ({ ...f, assignedTechnicianId: e.target.value }))}
            >
              <option value="">— Unassigned —</option>
              {techs.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
        <button
          type="submit"
          disabled={saving}
          className="w-full lg:w-auto rounded-lg tech-btn-primary text-white px-6 py-3 lg:py-2.5 text-sm font-semibold touch-manipulation min-h-[44px] lg:min-h-0 disabled:opacity-50"
        >
          {saving ? "Saving…" : !online ? "Save offline" : "Create job"}
        </button>
      </form>
    </div>
  );
}
