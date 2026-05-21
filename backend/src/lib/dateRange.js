/** Parse YYYY-MM-DD as UTC midnight; invalid returns null. */
export function parseDayParam(s) {
  if (!s || typeof s !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo || dt.getUTCDate() !== d) return null;
  return dt;
}

/** Inclusive start, exclusive end for Prisma `lt` upper bound. */
export function endExclusiveUtc(day) {
  const x = new Date(day);
  x.setUTCDate(x.getUTCDate() + 1);
  return x;
}
