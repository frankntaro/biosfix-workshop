import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import PaginationFooter from "../components/PaginationFooter.jsx";

const EDIT_ROLES = ["ADMIN", "RECEPTION", "TECHNICIAN"];

const CREATE_ROLES = [
  {
    id: "RECEPTION",
    label: "Reception",
    blurb: "Books in customers, creates jobs, records payments.",
    accent:
      "from-cyan-500/10 to-teal-500/5 border-cyan-500/30 text-cyan-900 dark:text-cyan-100 dark:border-cyan-400/30",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: "TECHNICIAN",
    label: "Technician",
    blurb: "Diagnoses devices, updates job status, completes repairs.",
    accent:
      "from-indigo-500/10 to-violet-500/5 border-indigo-500/30 text-indigo-900 dark:text-indigo-100 dark:border-indigo-400/30",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
      </svg>
    ),
  },
];

const PAGE_SIZE = 5;

function roleBadgeClass(role) {
  switch (role) {
    case "ADMIN":
      return "bg-amber-100 text-amber-900 border border-amber-200 dark:bg-amber-900/40 dark:text-amber-100 dark:border-amber-800/60";
    case "RECEPTION":
      return "bg-cyan-100 text-cyan-900 border border-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-100 dark:border-cyan-800/60";
    case "TECHNICIAN":
      return "bg-indigo-100 text-indigo-900 border border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-100 dark:border-indigo-800/60";
    default:
      return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200";
  }
}

function roleLabel(role) {
  if (role === "ADMIN") return "Admin";
  if (role === "RECEPTION") return "Reception";
  if (role === "TECHNICIAN") return "Technician";
  return role;
}

function generatePassword(len = 10) {
  const lo = "abcdefghjkmnpqrstuvwxyz";
  const up = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const dg = "23456789";
  const sp = "!@#$%&*";
  const all = lo + up + dg + sp;
  // Guarantee at least one of each pool
  const pick = (pool) => pool[Math.floor(Math.random() * pool.length)];
  const required = [pick(lo), pick(up), pick(dg), pick(sp)];
  const rest = Array.from({ length: Math.max(0, len - required.length) }, () => pick(all));
  return [...required, ...rest].sort(() => Math.random() - 0.5).join("");
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [listMeta, setListMeta] = useState({ total: 0, totalPages: 0, page: 1, pageSize: PAGE_SIZE });
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "RECEPTION" });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [createdNotice, setCreatedNotice] = useState(null);
  const [edit, setEdit] = useState(null);
  const nameInputRef = useRef(null);

  const load = useCallback(async (opts = {}) => {
    const activePage = typeof opts.page === "number" ? opts.page : page;
    setErr("");
    try {
      const params = new URLSearchParams({ page: String(activePage), pageSize: String(PAGE_SIZE) });
      const data = await api(`/users?${params}`);
      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      setUsers(items);
      if (data && typeof data.total === "number") {
        setListMeta({
          total: data.total,
          totalPages: data.totalPages ?? 0,
          page: data.page ?? activePage,
          pageSize: data.pageSize ?? PAGE_SIZE,
        });
      } else {
        setListMeta({ total: items.length, totalPages: items.length ? 1 : 0, page: 1, pageSize: PAGE_SIZE });
      }
      setPage(data?.page ?? activePage);
    } catch (e) {
      setErr(e.message);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  function validate() {
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    const password = form.password;
    if (!name) return "Name is required.";
    if (!email || !email.includes("@") || email.length < 3) return "Enter a valid email address.";
    if (!password || password.length < 6) return "Password must be at least 6 characters.";
    if (!["RECEPTION", "TECHNICIAN"].includes(form.role)) return "Choose a role.";
    return "";
  }

  async function create(e) {
    e.preventDefault();
    setErr("");
    setCreatedNotice(null);
    const v = validate();
    if (v) {
      setErr(v);
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: form.role,
      };
      const created = await api("/users", { method: "POST", body });
      setCreatedNotice({
        name: created?.name || body.name,
        email: created?.email || body.email,
        role: created?.role || body.role,
        password: body.password,
      });
      setForm({ name: "", email: "", password: "", role: form.role });
      setShowPassword(false);
      nameInputRef.current?.focus?.();
      await load({ page: 1 });
    } catch (ex) {
      setErr(ex.message || "Could not create user");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(u) {
    setErr("");
    setEdit({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      active: u.active,
      newPassword: "",
    });
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!edit) return;
    setErr("");
    try {
      const body = {
        name: edit.name,
        email: edit.email,
        role: edit.role,
        active: edit.active,
      };
      if (edit.newPassword.trim()) body.password = edit.newPassword.trim();
      await api(`/users/${edit.id}`, { method: "PATCH", body });
      setEdit(null);
      await load();
    } catch (ex) {
      setErr(ex.message);
    }
  }

  const canAdminResetPassword = (u) =>
    u.id !== currentUser?.id && (u.role === "RECEPTION" || u.role === "TECHNICIAN");

  const passwordLen = form.password.length;
  const passwordStrength = passwordLen === 0 ? null : passwordLen < 6 ? "weak" : passwordLen < 10 ? "ok" : "strong";

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard?.writeText?.(text);
    } catch {
      /* clipboard may be blocked; ignore */
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">
          Administration
        </p>
        <h1 className="text-xl sm:text-2xl font-bold tech-heading-gradient">Users & access</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 max-w-2xl">
          Create staff accounts for Reception and Technician roles. Admin accounts are managed by the system.
        </p>
      </header>

      {/* ───── Create user ───── */}
      <section className="tech-glass p-4 sm:p-6 space-y-5 max-w-3xl">
        <header className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-600 text-white shadow-sm shadow-cyan-900/20">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm6 11v-1a4 4 0 00-3-3.87M3 18v-1a4 4 0 014-4h6m6 8h-3m1.5-1.5V18m0 0v-1.5m0 1.5h1.5m-1.5 0H18" />
            </svg>
          </span>
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-slate-50">Create user</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pick a role, set their name and email, and create a temporary password.
            </p>
          </div>
        </header>

        {/* Role selector — cards */}
        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Role
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {CREATE_ROLES.map((r) => {
              const active = form.role === r.id;
              return (
                <label
                  key={r.id}
                  className={`relative cursor-pointer rounded-xl border bg-gradient-to-br p-4 transition tech-hover-lift ${
                    active
                      ? `${r.accent} shadow-sm`
                      : "from-white/60 to-white/30 dark:from-slate-900/40 dark:to-slate-900/20 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="new-user-role"
                    value={r.id}
                    checked={active}
                    onChange={() => setForm((f) => ({ ...f, role: r.id }))}
                    className="sr-only"
                  />
                  <div className="flex items-start gap-3">
                    <span
                      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        active
                          ? "bg-white/30 dark:bg-white/10"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {r.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">{r.label}</p>
                      <p className="text-xs opacity-80 mt-0.5">{r.blurb}</p>
                    </div>
                  </div>
                  <span
                    aria-hidden
                    className={`absolute right-3 top-3 inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                      active
                        ? "bg-white/80 border-current"
                        : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600"
                    }`}
                  >
                    {active && (
                      <svg className="h-3 w-3 text-current" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <form onSubmit={create} className="grid gap-4 sm:grid-cols-2">
          {/* Name */}
          <div className="sm:col-span-2">
            <label htmlFor="cu-name" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Full name
            </label>
            <input
              id="cu-name"
              ref={nameInputRef}
              required
              autoComplete="off"
              placeholder="e.g. Asha Mwita"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2.5 sm:py-2 text-sm min-h-[44px] sm:min-h-0 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="cu-email" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Email (sign-in)
            </label>
            <input
              id="cu-email"
              required
              type="email"
              autoComplete="off"
              placeholder="name@biosfix.local"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2.5 sm:py-2 text-sm min-h-[44px] sm:min-h-0 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="cu-password" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 flex items-center justify-between">
              <span>Temporary password</span>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, password: generatePassword(10) }))}
                className="text-[11px] font-medium text-cyan-700 dark:text-cyan-300 hover:underline normal-case tracking-normal"
              >
                Generate
              </button>
            </label>
            <div className="relative">
              <input
                id="cu-password"
                required
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                minLength={6}
                placeholder="At least 6 characters"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 pl-3 pr-11 py-2.5 sm:py-2 text-sm min-h-[44px] sm:min-h-0 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 font-mono"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-500 hover:text-cyan-700 hover:bg-cyan-500/10 dark:text-slate-400 dark:hover:text-cyan-200 dark:hover:bg-cyan-400/10 min-h-[40px] min-w-[40px] flex items-center justify-center"
              >
                {showPassword ? (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            {passwordStrength && (
              <p
                className={`text-[11px] mt-1 ${
                  passwordStrength === "weak"
                    ? "text-red-600 dark:text-red-400"
                    : passwordStrength === "ok"
                      ? "text-amber-700 dark:text-amber-300"
                      : "text-emerald-700 dark:text-emerald-300"
                }`}
              >
                {passwordStrength === "weak"
                  ? `Too short (${passwordLen}/6).`
                  : passwordStrength === "ok"
                    ? "OK — consider longer for stronger security."
                    : "Strong password."}
              </p>
            )}
          </div>

          {err && !edit && (
            <div className="sm:col-span-2 rounded-lg border border-red-300/60 dark:border-red-800/50 bg-red-50/80 dark:bg-red-950/30 text-red-900 dark:text-red-200 px-3 py-2 text-sm">
              {err}
            </div>
          )}

          <div className="sm:col-span-2 flex flex-col sm:flex-row gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto rounded-lg tech-btn-primary text-white px-5 py-3 sm:py-2.5 text-sm font-semibold touch-manipulation min-h-[44px] sm:min-h-0 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? "Creating…" : `Create ${roleLabel(form.role).toLowerCase()} account`}
            </button>
            <button
              type="button"
              onClick={() => {
                setForm({ name: "", email: "", password: "", role: form.role });
                setErr("");
                setCreatedNotice(null);
              }}
              className="w-full sm:w-auto rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-3 sm:py-2.5 text-sm touch-manipulation min-h-[44px] sm:min-h-0 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Clear
            </button>
          </div>
        </form>

        {createdNotice && (
          <div className="rounded-xl border border-emerald-300/60 dark:border-emerald-800/50 bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-100 p-4 space-y-2">
            <p className="text-sm font-semibold">
              {roleLabel(createdNotice.role)} account created for {createdNotice.name}.
            </p>
            <dl className="text-xs grid sm:grid-cols-2 gap-x-4 gap-y-1">
              <div className="flex gap-2">
                <dt className="text-emerald-700/70 dark:text-emerald-300/70">Email</dt>
                <dd className="font-mono break-all">{createdNotice.email}</dd>
              </div>
              <div className="flex gap-2 items-center">
                <dt className="text-emerald-700/70 dark:text-emerald-300/70">Temp password</dt>
                <dd className="font-mono break-all">{createdNotice.password}</dd>
                <button
                  type="button"
                  onClick={() => copyToClipboard(`${createdNotice.email} / ${createdNotice.password}`)}
                  className="ml-auto rounded-md border border-emerald-300/60 dark:border-emerald-700/60 px-2 py-1 text-[11px] hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
                >
                  Copy
                </button>
              </div>
            </dl>
            <p className="text-[11px] text-emerald-800/80 dark:text-emerald-200/80">
              Share these credentials privately. The user can change their password under <strong>My account</strong>.
            </p>
          </div>
        )}
      </section>

      {/* ───── Users table ───── */}
      <section className="space-y-3">
        <header className="flex items-baseline justify-between">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100">All users</h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">{listMeta.total} total</span>
        </header>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40">
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">Email</th>
                <th className="p-3 font-medium">Role</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 w-28 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                    No users yet.
                  </td>
                </tr>
              )}
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <td className="p-3 font-medium text-slate-900 dark:text-slate-100">{u.name}</td>
                  <td className="p-3 font-mono text-xs text-slate-700 dark:text-slate-300">{u.email}</td>
                  <td className="p-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${roleBadgeClass(u.role)}`}>
                      {roleLabel(u.role)}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className={`h-2 w-2 rounded-full ${
                          u.active ? "bg-emerald-500 shadow-[0_0_8px] shadow-emerald-500/50" : "bg-slate-400"
                        }`}
                      />
                      <span className="text-xs text-slate-700 dark:text-slate-300">
                        {u.active ? "Active" : "Disabled"}
                      </span>
                    </span>
                  </td>
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => openEdit(u)}
                      className="rounded-lg border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationFooter
            page={listMeta.page}
            totalPages={listMeta.totalPages}
            total={listMeta.total}
            pageSize={listMeta.pageSize}
            noun="users"
            onPageChange={setPage}
          />
        </div>
      </section>

      {edit && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto overscroll-contain rounded-t-2xl sm:rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-6 space-y-4 sm:m-4">
            <h2 className="text-lg font-semibold">Edit user</h2>
            <form onSubmit={saveEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Name</label>
                <input
                  required
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  value={edit.name}
                  onChange={(e) => setEdit((x) => ({ ...x, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Email</label>
                <input
                  required
                  type="email"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  value={edit.email}
                  onChange={(e) => setEdit((x) => ({ ...x, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Role</label>
                <select
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  value={edit.role}
                  onChange={(e) => setEdit((x) => ({ ...x, role: e.target.value }))}
                  disabled={edit.id === currentUser?.id}
                >
                  {EDIT_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(r)}
                    </option>
                  ))}
                </select>
                {edit.id === currentUser?.id && (
                  <p className="text-xs text-slate-500 mt-1">You cannot change your own role here.</p>
                )}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={edit.active}
                  onChange={(e) => setEdit((x) => ({ ...x, active: e.target.checked }))}
                  disabled={edit.id === currentUser?.id}
                />
                Active
                {edit.id === currentUser?.id && <span className="text-xs text-slate-500">(use another admin to deactivate your account)</span>}
              </label>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  New password {canAdminResetPassword(edit) ? "(optional reset)" : "(optional)"}
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Leave blank to keep current password"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  value={edit.newPassword}
                  onChange={(e) => setEdit((x) => ({ ...x, newPassword: e.target.value }))}
                />
                {canAdminResetPassword(edit) && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Set a temporary password and ask them to sign in and change it under My account.
                  </p>
                )}
              </div>
              {err && edit && <p className="text-red-600 dark:text-red-400 text-sm">{err}</p>}
              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setEdit(null);
                    setErr("");
                  }}
                  className="w-full sm:w-auto rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-3 sm:py-2 text-sm touch-manipulation min-h-[44px] sm:min-h-0"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto rounded-lg tech-btn-primary text-white px-4 py-3 sm:py-2 text-sm font-semibold touch-manipulation min-h-[44px] sm:min-h-0"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
