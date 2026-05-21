const DB_NAME = "biosfix-workshop";
const DB_VERSION = 2;
const STORE_OUTBOX = "outbox";
const STORE_CUSTOMERS = "customerCache";
const STORE_JOB_LIST = "jobListCache";
const STORE_JOB_DETAIL = "jobDetailCache";
const STORE_DASHBOARD = "dashboardCache";

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = (ev) => {
      const db = req.result;
      const old = ev.oldVersion;
      if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
        db.createObjectStore(STORE_OUTBOX, { keyPath: "id", autoIncrement: true });
      }
      if (old < 2) {
        if (!db.objectStoreNames.contains(STORE_CUSTOMERS)) {
          db.createObjectStore(STORE_CUSTOMERS, { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains(STORE_JOB_LIST)) {
          db.createObjectStore(STORE_JOB_LIST, { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains(STORE_JOB_DETAIL)) {
          db.createObjectStore(STORE_JOB_DETAIL, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_DASHBOARD)) {
          db.createObjectStore(STORE_DASHBOARD, { keyPath: "key" });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

export async function addOutboxEntry(entry) {
  const db = await openDb();
  if (!db) return -1;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_OUTBOX, "readwrite");
    const r = tx.objectStore(STORE_OUTBOX).add(entry);
    r.onerror = () => reject(r.error);
    r.onsuccess = () => {};
    tx.oncomplete = () => {
      resolve(r.result);
      db.close();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllOutbox() {
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_OUTBOX, "readonly");
    const store = tx.objectStore(STORE_OUTBOX);
    const r = store.getAll();
    r.onerror = () => reject(r.error);
    tx.oncomplete = () => {
      resolve(r.result || []);
      db.close();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteOutboxEntry(id) {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_OUTBOX, "readwrite");
    tx.objectStore(STORE_OUTBOX).delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function outboxCount() {
  const rows = await getAllOutbox();
  return rows.length;
}

/** @returns {Promise<object[]|null>} */
export async function getCustomerListCache() {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CUSTOMERS, "readonly");
    const r = tx.objectStore(STORE_CUSTOMERS).get("all");
    r.onerror = () => reject(r.error);
    tx.oncomplete = () => {
      db.close();
      try {
        if (!r.result?.rows) return resolve(null);
        const parsed = JSON.parse(r.result.rows);
        resolve(Array.isArray(parsed) ? parsed : null);
      } catch {
        resolve(null);
      }
    };
    tx.onerror = () => reject(tx.error);
  });
}

/** @param {object[]} rows */
export async function putCustomerListCache(rows) {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CUSTOMERS, "readwrite");
    tx.objectStore(STORE_CUSTOMERS).put({
      key: "all",
      rows: JSON.stringify(rows),
      savedAt: Date.now(),
    });
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

/** Merge a fetched customers page into cache by id (newest first), capped for storage. */
export async function mergeCustomerListCache(incoming) {
  if (!Array.isArray(incoming) || incoming.length === 0) return;
  const existing = (await getCustomerListCache()) || [];
  const map = new Map(existing.map((c) => [c.id, c]));
  for (const c of incoming) {
    if (c?.id) map.set(c.id, c);
  }
  const merged = [...map.values()].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  await putCustomerListCache(merged.slice(0, 400));
}

/** @returns {Promise<object[]|null>} */
export async function getJobListCache() {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_JOB_LIST, "readonly");
    const r = tx.objectStore(STORE_JOB_LIST).get("all");
    r.onerror = () => reject(r.error);
    tx.oncomplete = () => {
      db.close();
      try {
        if (!r.result?.rows) return resolve(null);
        const parsed = JSON.parse(r.result.rows);
        resolve(Array.isArray(parsed) ? parsed : null);
      } catch {
        resolve(null);
      }
    };
    tx.onerror = () => reject(tx.error);
  });
}

/** @param {object[]} rows */
export async function putJobListCache(rows) {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_JOB_LIST, "readwrite");
    tx.objectStore(STORE_JOB_LIST).put({
      key: "all",
      rows: JSON.stringify(rows),
      savedAt: Date.now(),
    });
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

/** Merge a fetched jobs page into cache by id (newest first), capped for storage. */
export async function mergeJobListCache(incoming) {
  if (!Array.isArray(incoming) || incoming.length === 0) return;
  const existing = (await getJobListCache()) || [];
  const map = new Map(existing.map((j) => [j.id, j]));
  for (const j of incoming) {
    if (j?.id) map.set(j.id, j);
  }
  const merged = [...map.values()].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  await putJobListCache(merged.slice(0, 500));
}

/** @returns {Promise<object|null>} */
export async function getJobDetailCache(jobId) {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_JOB_DETAIL, "readonly");
    const r = tx.objectStore(STORE_JOB_DETAIL).get(jobId);
    r.onerror = () => reject(r.error);
    tx.oncomplete = () => {
      db.close();
      try {
        if (!r.result?.payload) return resolve(null);
        resolve(JSON.parse(r.result.payload));
      } catch {
        resolve(null);
      }
    };
    tx.onerror = () => reject(tx.error);
  });
}

/** @param {object} job */
export async function putJobDetailCache(job) {
  const db = await openDb();
  if (!db || !job?.id) return;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_JOB_DETAIL, "readwrite");
    tx.objectStore(STORE_JOB_DETAIL).put({
      id: job.id,
      payload: JSON.stringify(job),
      savedAt: Date.now(),
    });
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

/** @returns {Promise<object|null>} */
export async function getDashboardCache() {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DASHBOARD, "readonly");
    const r = tx.objectStore(STORE_DASHBOARD).get("summary");
    r.onerror = () => reject(r.error);
    tx.oncomplete = () => {
      db.close();
      try {
        if (!r.result?.payload) return resolve(null);
        resolve(JSON.parse(r.result.payload));
      } catch {
        resolve(null);
      }
    };
    tx.onerror = () => reject(tx.error);
  });
}

/** @param {object} data */
export async function putDashboardCache(data) {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DASHBOARD, "readwrite");
    tx.objectStore(STORE_DASHBOARD).put({
      key: "summary",
      payload: JSON.stringify(data),
      savedAt: Date.now(),
    });
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export function filterCustomersLocal(rows, q) {
  const t = (q || "").trim().toLowerCase();
  if (!t) return rows;
  return rows.filter((c) => {
    const name = (c.name || "").toLowerCase();
    const phone = (c.phone || "").toLowerCase();
    const email = (c.email || "").toLowerCase();
    return name.includes(t) || phone.includes(t) || email.includes(t);
  });
}

export function filterJobsLocal(rows, q) {
  const t = (q || "").trim().toLowerCase();
  if (!t) return rows;
  return rows.filter((j) => {
    const num = (j.jobNumber || "").toLowerCase();
    const cust = (j.customer?.name || "").toLowerCase();
    const ph = (j.customer?.phone || "").toLowerCase();
    const dev = `${j.device?.brand || ""} ${j.device?.model || ""}`.toLowerCase();
    return num.includes(t) || cust.includes(t) || ph.includes(t) || dev.includes(t);
  });
}
