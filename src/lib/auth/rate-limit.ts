/**
 * Small in-memory sliding-window limiter for sign-in/sign-up/demo attempts.
 * Best-effort only (per server instance). Supabase Auth applies its own provider-side rate limits.
 */
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    buckets.set(key, recent);
    return false;
  }
  recent.push(now);
  buckets.set(key, recent);
  if (buckets.size > 5000) buckets.clear(); // bound memory
  return true;
}

export function resetRateLimits() {
  buckets.clear();
}
