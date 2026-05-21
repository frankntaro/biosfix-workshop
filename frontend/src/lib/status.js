export const STATUSES = [
  { value: "PENDING", label: "Pending", description: "Received; not started" },
  { value: "DIAGNOSING", label: "Diagnosing", description: "Inspection" },
  { value: "IN_PROGRESS", label: "In progress", description: "Repair in progress" },
  { value: "WAITING_PARTS", label: "Waiting parts", description: "Awaiting parts" },
  { value: "COMPLETE", label: "Complete", description: "Repair complete" },
  { value: "DELIVERED", label: "Delivered", description: "Collected" },
  { value: "CANCELLED", label: "Cancelled", description: "Cancelled" },
];

/** Jobs page filter labels when opened from dashboard stat cards. */
export const JOBS_PAGE_STATUS_FILTER = {
  PENDING: {
    title: "Pending",
    description: "Received at reception — workshop has not started yet.",
  },
  IN_PROGRESS: {
    title: "Under repair",
    description: "Repair in progress.",
  },
  COMPLETE: {
    title: "Completed",
    description: "Repair finished — ready for customer collection.",
  },
};

export const TECH_QUICK_STATUSES = STATUSES.filter((s) =>
  ["DIAGNOSING", "IN_PROGRESS", "WAITING_PARTS", "COMPLETE"].includes(s.value),
);

export const RECEPTION_STATUS_SELECT = STATUSES.filter((s) => s.value !== "DELIVERED");

export function statusDescription(status) {
  const row = STATUSES.find((s) => s.value === status);
  return row?.description ?? "";
}

export function statusLabel(status) {
  const row = STATUSES.find((s) => s.value === status);
  return row?.label ?? status;
}

export function statusBadgeClass(status) {
  const map = {
    PENDING: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
    DIAGNOSING: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100",
    IN_PROGRESS: "bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100",
    WAITING_PARTS: "bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-100",
    COMPLETE: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100",
    DELIVERED: "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100",
    CANCELLED: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100",
  };
  return map[status] || "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200";
}
