/**
 * Best-effort unique id. Uses crypto.randomUUID when available (browser),
 * falls back to a timestamp+random string for non-secure contexts/tests.
 */
export function generateId(prefix = ''): string {
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return prefix ? `${prefix}_${uuid}` : uuid;
}
