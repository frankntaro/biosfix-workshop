import { getToken, setToken } from "./authSession.js";

const prefix = import.meta.env.VITE_API_PREFIX ?? "/api";

export async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && typeof options.body === "object" && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${prefix}${path}`, { ...options, headers });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }
  if (!res.ok) {
    const err = new Error(data?.error || res.statusText || "Request failed");
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const EXT_BY_MIME = {
  "application/pdf": "pdf",
  "text/csv": "csv",
  "application/csv": "csv",
  "application/vnd.ms-excel": "csv",
  "application/json": "json",
  "text/plain": "txt",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "application/zip": "zip",
};

function parseContentDispositionFilename(header) {
  if (!header) return "";
  // RFC 5987: filename*=UTF-8''encoded-name
  const star = /filename\*\s*=\s*([^']*)'[^']*'([^;]+)/i.exec(header);
  if (star) {
    try {
      return decodeURIComponent(star[2].trim());
    } catch {
      return star[2].trim();
    }
  }
  // Quoted or bare filename
  const plain = /filename\s*=\s*("([^"]+)"|([^;]+))/i.exec(header);
  if (plain) return (plain[2] || plain[3] || "").trim();
  return "";
}

function extFromUrl(path) {
  try {
    const u = new URL(path, "http://x");
    const m = /\.([a-z0-9]{1,8})$/i.exec(u.pathname);
    return m ? m[1].toLowerCase() : "";
  } catch {
    const m = /\.([a-z0-9]{1,8})(?:[?#]|$)/i.exec(path);
    return m ? m[1].toLowerCase() : "";
  }
}

function ensureExtension(filename, ext) {
  if (!ext) return filename;
  const lower = filename.toLowerCase();
  return lower.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`;
}

/**
 * Authenticated GET; saves response as a file.
 * The extension is taken from the server's Content-Disposition header when
 * present; otherwise inferred from the request path or Content-Type.
 */
export async function downloadFile(path, fallbackFilename = "download") {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${prefix}${path}`, { headers });
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try {
      const j = JSON.parse(text);
      if (j?.error) msg = j.error;
    } catch {
      /* plain text */
    }
    throw new Error(msg || res.statusText || "Download failed");
  }

  const cd = res.headers.get("Content-Disposition") || "";
  const serverName = parseContentDispositionFilename(cd);
  const contentType = (res.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  const urlExt = extFromUrl(path);
  const mimeExt = EXT_BY_MIME[contentType] || "";
  const inferredExt = urlExt || mimeExt || "";

  let filename = serverName || fallbackFilename;
  filename = ensureExtension(filename, inferredExt);

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export { getToken, setToken };
