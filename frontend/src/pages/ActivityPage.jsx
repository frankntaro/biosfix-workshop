import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import PaginationFooter from "../components/PaginationFooter.jsx";

const PAGE_SIZE = 5;

export default function ActivityPage() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const [page, setPage] = useState(1);
  const [listMeta, setListMeta] = useState({ total: 0, totalPages: 0, page: 1, pageSize: PAGE_SIZE });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setErr("");
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      const data = await api(`/activity?${params}`);
      const list = Array.isArray(data?.items) ? data.items : [];
      setItems(list);
      if (data && typeof data.total === "number") {
        setListMeta({
          total: data.total,
          totalPages: data.totalPages ?? 0,
          page: data.page ?? page,
          pageSize: data.pageSize ?? PAGE_SIZE,
        });
        setPage(data.page ?? page);
      } else {
        setListMeta({ total: list.length, totalPages: list.length ? 1 : 0, page: 1, pageSize: PAGE_SIZE });
        setPage(1);
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !items.length && !err) {
    return <p className="text-slate-500">Loading…</p>;
  }

  if (err && !items.length) return <p className="text-red-600 dark:text-red-400">{err}</p>;

  return (
    <div className="space-y-6 max-w-4xl">
      <header>
        <h1 className="text-xl sm:text-2xl font-bold">Activity log</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{listMeta.total} entries</p>
      </header>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 overflow-hidden">
        <ul className="space-y-2 text-sm p-3 sm:p-4">
          {items.map((a) => (
            <li key={a.id} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40 p-3">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-mono text-xs text-slate-500">{new Date(a.createdAt).toLocaleString()}</span>
                <span className="font-semibold text-cyan-800 dark:text-cyan-200">{a.action}</span>
              </div>
              {a.user && (
                <p className="text-xs text-slate-500 mt-1">
                  User: {a.user.name} ({a.user.role}) {a.user.email ? `· ${a.user.email}` : ""}
                </p>
              )}
              {(a.entityType || a.entityId) && (
                <p className="text-xs mt-1">
                  {a.entityType}{" "}
                  {a.entityId && a.entityType === "Job" ? (
                    <Link to={`/jobs/${a.entityId}`} className="text-cyan-600 dark:text-cyan-400 hover:underline font-mono">
                      {a.entityId}
                    </Link>
                  ) : (
                    a.entityId
                  )}
                </p>
              )}
              {a.metadata != null && Object.keys(a.metadata).length > 0 && (
                <pre className="text-[11px] mt-2 p-2 rounded bg-slate-50 dark:bg-slate-950 overflow-x-auto max-h-32">{JSON.stringify(a.metadata, null, 2)}</pre>
              )}
            </li>
          ))}
        </ul>
        {!items.length && !loading && <p className="px-4 pb-4 text-sm text-slate-500 text-center">No activity yet.</p>}
        <PaginationFooter
          page={listMeta.page}
          totalPages={listMeta.totalPages}
          total={listMeta.total}
          pageSize={listMeta.pageSize}
          noun="items"
          disabled={loading}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
