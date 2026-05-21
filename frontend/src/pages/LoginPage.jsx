import { useState } from "react";
import { useNavigate } from "react-router-dom";
import BrandLogo from "../components/BrandLogo.jsx";
import PasswordInput from "../components/PasswordInput.jsx";
import { useAuth } from "../lib/auth.jsx";

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    try {
      await login(email, password);
      nav("/");
    } catch (ex) {
      setErr(ex.message || "Login failed");
    }
  }

  const bgSpot = (placement, delayClass) => (
    <div className={`login-bg-spot ${placement}`} aria-hidden>
      <div className={`login-hero-stage login-hero-stage--bg ${delayClass}`}>
        <p className="login-hero-wordmark login-hero-wordmark--bg">BIOSFIX TECHNOLOGY</p>
        <div className="login-hero-logo-wrap">
          <BrandLogo className="login-bg-spot-logo" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="tech-login-shell min-h-[100dvh] relative flex items-center justify-center px-4 py-8 sm:p-6 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="tech-login-sheen absolute inset-0 z-[1]" aria-hidden />
      <div className="login-bg-floats pointer-events-none absolute inset-0 z-[5] overflow-hidden" aria-hidden>
        {bgSpot("login-bg-spot--tl", "login-bg-delay-a")}
        {bgSpot("login-bg-spot--tr", "login-bg-delay-b")}
        {bgSpot("login-bg-spot--center", "login-bg-delay-c")}
        {bgSpot("login-bg-spot--bl", "login-bg-delay-d")}
        {bgSpot("login-bg-spot--br", "login-bg-delay-e")}
      </div>
      <div className="relative z-10 w-full max-w-md min-w-0 flex flex-col items-center px-1">
        <div className="tech-login-card w-full rounded-2xl bg-white/95 dark:bg-slate-900/90 p-5 sm:p-8">
          <div
            className="tech-login-brand mx-auto mb-5 sm:mb-6 flex w-full max-w-[min(280px,100%)] flex-col items-center gap-3 rounded-xl border bg-slate-50/90 dark:bg-slate-800/80 px-3 py-4 sm:px-4 text-center"
            aria-label="BIOSFIX Workshop"
          >
            <BrandLogo className="tech-login-card-logo h-14 w-14 sm:h-16 sm:w-16 shrink-0 ring-2 ring-cyan-400/35 dark:ring-cyan-400/25 shadow-[0_8px_28px_-6px_rgb(6_182_212/0.45)]" />
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-800 dark:text-cyan-300 leading-snug">
              BIOSFIX WORKSHOP
            </p>
            <p className="text-sm text-cyan-900/90 dark:text-cyan-200/90">Sign in</p>
          </div>
          <form onSubmit={onSubmit} className="mt-6 space-y-4" autoComplete="on">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-cyan-200/80 mb-1">Email</label>
              <input
                className="w-full rounded-lg border border-cyan-500/20 dark:border-cyan-400/20 bg-white dark:bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/40 dark:focus:ring-cyan-400/30 transition-shadow"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                placeholder=""
              />
            </div>
            <PasswordInput
              id="login-password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
            <button
              type="submit"
              className="tech-btn-primary w-full rounded-lg text-white font-semibold py-3 sm:py-2.5 text-sm touch-manipulation min-h-[44px] sm:min-h-0"
            >
              Sign in
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
