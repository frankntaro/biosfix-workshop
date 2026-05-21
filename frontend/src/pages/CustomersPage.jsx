import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import * as idb from "../lib/offlineDb.js";
import PaginationFooter from "../components/PaginationFooter.jsx";

const PAGE_SIZE = 5;

export default function CustomersPage() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [page, setPage] = useState(1);
  const [listMeta, setListMeta] = useState({ total: 0, totalPages: 0, page: 1, pageSize: PAGE_SIZE });
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [q]);

  const load = useCallback(async (opts = {}) => {
    const activePage = typeof opts.page === "number" ? opts.page : page;
    setErr("");
    if (!navigator.onLine) {
      const raw = await idb.getCustomerListCache();
      if (!raw?.length) {
        setList([]);
        setFromCache(false);
        setListMeta({ total: 0, totalPages: 0, page: 1, pageSize: PAGE_SIZE });
        setErr("Offline. No cached customer list.");
        return;
      }
      const filtered = idb.filterCustomersLocal(raw, q);
      const total = filtered.length;
      const totalPages = total === 0 ? 0 : Math.ceil(total / PAGE_SIZE);
      const safePage = totalPages === 0 ? 1 : Math.min(activePage, totalPages);
      const start = (safePage - 1) * PAGE_SIZE;
      setList(filtered.slice(start, start + PAGE_SIZE));
      setListMeta({ total, totalPages, page: safePage, pageSize: PAGE_SIZE });
      if (safePage !== page) setPage(safePage);
      setFromCache(true);
      return;
    }
    const params = new URLSearchParams({ page: String(activePage), pageSize: String(PAGE_SIZE) });
    if (q.trim()) params.set("q", q.trim());
    try {
      const data = await api(`/customers?${params}`);
      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      setList(items);
      setFromCache(false);
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
      await idb.mergeCustomerListCache(items);
    } catch (e) {
      const raw = await idb.getCustomerListCache();
      if (raw?.length) {
        const filtered = idb.filterCustomersLocal(raw, q);
        const total = filtered.length;
        const totalPages = total === 0 ? 0 : Math.ceil(total / PAGE_SIZE);
        const safePage = totalPages === 0 ? 1 : Math.min(activePage, totalPages);
        const start = (safePage - 1) * PAGE_SIZE;
        setList(filtered.slice(start, start + PAGE_SIZE));
        setListMeta({ total, totalPages, page: safePage, pageSize: PAGE_SIZE });
        if (safePage !== page) setPage(safePage);
        setFromCache(true);
        setErr("");
      } else {
        setErr(e.message);
      }
    }
  }, [q, page]);

  useEffect(() => {
    const t = setTimeout(() => {
      load();
    }, 300);
    return () => clearTimeout(t);
  }, [q, page, load]);

  useEffect(() => {
    const onUp = () => load();
    window.addEventListener("online", onUp);
    return () => window.removeEventListener("online", onUp);
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Customers</h1>
        {fromCache && (
          <p className="text-sm text-amber-800 dark:text-amber-200 mt-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/90 dark:bg-amber-950/40 px-3 py-2">
            Cached list. Connect for live data.
          </p>
        )}
        {user?.role === "TECHNICIAN" && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-xl">Customers from your assigned jobs.</p>
        )}
      </div>
      <input
        placeholder="Search customers…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full max-w-md rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
      />
      {err && <p className="text-red-600 text-sm">{err}</p>}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
              <th className="p-3">Name</th>
              <th className="p-3">Phone</th>
              <th className="p-3">Jobs</th>
              {(user?.role === "ADMIN" || user?.role === "RECEPTION") && <th className="p-3 w-28">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 dark:border-slate-800">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3">{c.phone}</td>
                <td className="p-3">{c._count?.jobs ?? "—"}</td>
                {(user?.role === "ADMIN" || user?.role === "RECEPTION") && (
                  <td className="p-3">
                    <Link
                      to={`/customers/${c.id}/new-job`}
                      className="text-sm text-sky-600 dark:text-cyan-400 font-medium hover:underline touch-manipulation"
                    >
                      New job
                    </Link>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <PaginationFooter
          page={listMeta.page}
          totalPages={listMeta.totalPages}
          total={listMeta.total}
          pageSize={listMeta.pageSize}
          noun="customers"
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
