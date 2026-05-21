import { useState } from "react";
import { useNavigate } from "react-router-dom";
import BrandLogo from "../components/BrandLogo.jsx";
import { useAuth } from "../lib/auth.jsx";

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("admin@biosfix.local");
  const [password, setPassword] = useState("admin123");
  const [showPassword, setShowPassword] = useState(false);
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
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-cyan-200/80 mb-1">Email</label>
              <input
                className="w-full rounded-lg border border-cyan-500/20 dark:border-cyan-400/20 bg-white dark:bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/40 dark:focus:ring-cyan-400/30 transition-shadow"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-cyan-200/80 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full rounded-lg border border-cyan-500/20 dark:border-cyan-400/20 bg-white dark:bg-slate-950 pl-3 pr-11 py-2.5 sm:py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/40 dark:focus:ring-cyan-400/30 transition-shadow"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-500 hover:bg-cyan-500/10 hover:text-cyan-700 dark:text-cyan-300/70 dark:hover:bg-cyan-400/10 dark:hover:text-cyan-200 touch-manipulation min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:p-1.5 flex items-center justify-center"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>
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
