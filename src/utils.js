/**
 * Safe string extractor that guarantees an object will NEVER be rendered directly as a React child.
 * Protects against React Invariant Error #31 (Objects are not valid as a React child).
 */
export function safeString(val, fallback = '') {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (typeof val === 'object') {
    if (val.message && typeof val.message === 'string') {
      return val.code ? `${val.message} (Code: ${val.code})` : val.message;
    }
    if (val.error) {
      if (typeof val.error === 'string') return val.error;
      if (typeof val.error === 'object' && val.error.message) {
        return val.error.code ? `${val.error.message} (Code: ${val.error.code})` : String(val.error.message);
      }
    }
    if (val.code && typeof val.code === 'string') return `Code: ${val.code}`;
    try {
      return JSON.stringify(val);
    } catch {
      return fallback;
    }
  }
  return String(val);
}
