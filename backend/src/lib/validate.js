/** Prisma cuid() ids — reject malformed route/body ids early */
const CUID_RE = /^c[a-z0-9]{20,32}$/i;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Strip HTML/script-like content from user text (stored XSS mitigation). */
export function sanitizeText(value, maxLen = 2000) {
  if (value == null) return "";
  if (typeof value !== "string") return "";
  let s = value
    .replace(/[\0-\x08\x0b\x0c\x0e-\x1f]/g, "")
    .replace(/<[^>]*>/g, "")
    .trim();
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

export function isCuid(value) {
  return typeof value === "string" && CUID_RE.test(value);
}

export function validateEmail(email) {
  if (typeof email !== "string") return null;
  const e = email.trim().toLowerCase();
  if (e.length < 3 || e.length > 254 || !EMAIL_RE.test(e)) return null;
  return e;
}

export function clampSearchQuery(q, maxLen = 80) {
  if (typeof q !== "string") return "";
  return sanitizeText(q, maxLen);
}

export function validatePassword(password, minLen = 8) {
  if (typeof password !== "string" || password.length < minLen) return null;
  if (password.length > 128) return null;
  return password;
}

/** Block NoSQL-style / prototype pollution keys in JSON bodies */
export function stripDangerousKeys(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(stripDangerousKeys);
  const out = {};
  for (const [key, val] of Object.entries(obj)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    if (key.startsWith("$")) continue;
    out[key] = stripDangerousKeys(val);
  }
  return out;
}

/** Express router.param — validate :id style params */
export function bindCuidParams(router, ...paramNames) {
  for (const name of paramNames) {
    router.param(name, (req, res, next, value) => {
      if (!isCuid(value)) return res.status(400).json({ error: "Invalid id" });
      next();
    });
  }
}
