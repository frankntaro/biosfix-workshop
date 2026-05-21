/** Digits only for stable matching (spaces, dashes, +255, etc. ignored). */
export function normalizePhone(phone) {
  if (phone == null || typeof phone !== "string") return "";
  const d = phone.replace(/\D/g, "");
  return d;
}

/** Trim, collapse internal whitespace, lowercase (for duplicate name matching). */
export function normalizeCustomerName(name) {
  if (name == null || typeof name !== "string") return "";
  return name
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function customerIdentityKeys(name, phone) {
  return {
    phoneKey: normalizePhone(phone),
    nameKey: normalizeCustomerName(name),
  };
}
