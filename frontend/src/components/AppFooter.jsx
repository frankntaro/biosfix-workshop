/** Site-wide copyright — login and authenticated pages */
export default function AppFooter({ className = "" }) {
  const year = new Date().getFullYear();
  return (
    <footer
      className={`text-center text-[11px] sm:text-xs leading-relaxed text-slate-500 dark:text-slate-400 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] print:hidden ${className}`}
    >
      <p>
        Developed and powered by{" "}
        <span className="font-semibold text-slate-600 dark:text-slate-300">SOFT-LINK AFRICA</span> Software
        development team.
      </p>
      <p className="mt-1">© {year} All rights reserved.</p>
    </footer>
  );
}
