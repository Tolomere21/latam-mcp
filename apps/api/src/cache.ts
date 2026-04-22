type Entry<V> = { value: V; expiresAt: number };

export class TtlCache<V> {
  private fresh = new Map<string, Entry<V>>();
  private stale = new Map<string, V>();
  constructor(private readonly maxEntries = 10_000) {}

  get(key: string): V | undefined {
    const e = this.fresh.get(key);
    if (!e) return undefined;
    if (Date.now() > e.expiresAt) {
      this.fresh.delete(key);
      return undefined;
    }
    return e.value;
  }

  getStale(key: string): V | undefined {
    return this.stale.get(key);
  }

  set(key: string, value: V, ttlMs: number) {
    if (this.fresh.size >= this.maxEntries) {
      const first = this.fresh.keys().next().value;
      if (first !== undefined) this.fresh.delete(first);
    }
    this.fresh.set(key, { value, expiresAt: Date.now() + ttlMs });
    this.stale.set(key, value);
  }
}

export type CacheStatus = "HIT" | "MISS" | "STALE";

export async function cachedUpstream<V>(
  cache: TtlCache<V>,
  key: string,
  ttlMs: number,
  fetcher: () => Promise<V>,
): Promise<{ value: V; status: CacheStatus }> {
  const hit = cache.get(key);
  if (hit) return { value: hit, status: "HIT" };

  try {
    const value = await fetcher();
    cache.set(key, value, ttlMs);
    return { value, status: "MISS" };
  } catch (err) {
    const stale = cache.getStale(key);
    if (stale) return { value: stale, status: "STALE" };
    throw err;
  }
}
