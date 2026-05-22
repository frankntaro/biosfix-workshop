/**
 * Escape text for safe HTML display (defense in depth; React already escapes JSX).
 * Use if you ever render user content via innerHTML or document.write.
 */
export function escapeHtml(text) {
  if (text == null) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
