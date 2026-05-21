import { useEffect, useState } from "react";
import PasswordInput from "../components/PasswordInput.jsx";
import { api, setToken } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";

export default function AccountPage() {
  const { user, refresh } = useAuth();
  const [profile, setProfile] = useState({ name: "", email: "" });
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (user) setProfile({ name: user.name || "", email: user.email || "" });
  }, [user]);

  async function saveProfile(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    try {
      const data = await api("/auth/me", {
        method: "PATCH",
        body: { name: profile.name, email: profile.email },
      });
      if (data.token) setToken(data.token);
      await refresh();
      setMsg("Profile updated.");
    } catch (ex) {
      setErr(ex.message);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    if (pwd.next !== pwd.confirm) {
      setErr("New password and confirmation do not match.");
      return;
    }
    try {
      const data = await api("/auth/me", {
        method: "PATCH",
        body: { currentPassword: pwd.current, newPassword: pwd.next },
      });
      if (data.token) setToken(data.token);
      await refresh();
      setPwd({ current: "", next: "", confirm: "" });
      setMsg("Password changed.");
    } catch (ex) {
      setErr(ex.message);
    }
  }

  return (
    <div className="space-y-8 max-w-lg">
      <header>
        <h1 className="text-2xl font-bold leading-tight">My account</h1>
      </header>
      <p className="text-sm text-slate-500 dark:text-slate-400">Profile and password.</p>
      {(msg || err) && (
        <p className={`text-sm rounded-lg px-3 py-2 ${err ? "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200" : "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"}`}>
          {err || msg}
        </p>
      )}

      <form onSubmit={saveProfile} className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4">
        <h2 className="font-semibold text-sky-600 text-sm">Profile</h2>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Display name</label>
          <input
            required
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            value={profile.name}
            onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Email</label>
          <input
            required
            type="email"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            value={profile.email}
            onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
          />
        </div>
        <button
          type="submit"
          className="w-full sm:w-auto rounded-lg bg-sky-600 text-white px-4 py-3 sm:py-2 text-sm font-medium touch-manipulation min-h-[44px] sm:min-h-0"
        >
          Save profile
        </button>
      </form>

      <form onSubmit={savePassword} className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4">
        <h2 className="font-semibold text-sky-600 text-sm">Change password</h2>
        <PasswordInput
          id="pwd-current"
          label="Current password"
          value={pwd.current}
          onChange={(e) => setPwd((p) => ({ ...p, current: e.target.value }))}
          autoComplete="current-password"
        />
        <PasswordInput
          id="pwd-new"
          label="New password (min 6 characters)"
          value={pwd.next}
          onChange={(e) => setPwd((p) => ({ ...p, next: e.target.value }))}
          autoComplete="new-password"
        />
        <PasswordInput
          id="pwd-confirm"
          label="Confirm new password"
          value={pwd.confirm}
          onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))}
          autoComplete="new-password"
        />
        <button
          type="submit"
          className="w-full sm:w-auto rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 px-4 py-3 sm:py-2 text-sm font-medium touch-manipulation min-h-[44px] sm:min-h-0"
        >
          Change password
        </button>
      </form>
    </div>
  );
}
