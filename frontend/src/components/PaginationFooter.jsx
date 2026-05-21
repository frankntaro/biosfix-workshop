/**
 * @param {{
 *   page: number;
 *   totalPages: number;
 *   total: number;
 *   pageSize: number;
 *   onPageChange: (page: number) => void;
 *   noun?: string;
 *   disabled?: boolean;
 * }} props
 */
export default function PaginationFooter({ page, totalPages, total, pageSize, onPageChange, noun = "results", disabled }) {
  if (total === 0) return null;

  const label =
    totalPages <= 1
      ? `${total} ${total === 1 ? noun.replace(/s$/, "") : noun}`
      : `Page ${page} of ${totalPages} · ${total} ${noun} (${pageSize} per page)`;

  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-200 dark:border-slate-800 px-3 py-3 bg-slate-50/80 dark:bg-slate-900/40 print:hidden">
      <p className="text-sm text-slate-600 dark:text-slate-400">{label}</p>
      {totalPages > 1 && (
        <div className="flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            disabled={disabled || page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-medium disabled:opacity-40 touch-manipulation min-h-[44px] sm:min-h-0"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={disabled || page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-medium disabled:opacity-40 touch-manipulation min-h-[44px] sm:min-h-0"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
