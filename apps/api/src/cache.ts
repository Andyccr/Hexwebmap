export class LruTtlCache<T> {
  private readonly map = new Map<string, { value: T; expires: number }>();

  constructor(
    private readonly max = 500,
    private readonly ttlMs = 5 * 60_000,
  ) {}

  get(key: string): T | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.expires) {
      this.map.delete(key);
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.value;
  }

  set(key: string, value: T): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expires: Date.now() + this.ttlMs });
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  get size(): number {
    return this.map.size;
  }
}

export class TokenBucket {
  private readonly buckets = new Map<string, { tokens: number; updated: number }>();

  constructor(
    private readonly ratePerSec: number,
    private readonly burst: number,
  ) {}

  take(key: string, cost = 1): boolean {
    const now = Date.now();
    let b = this.buckets.get(key);
    if (!b) {
      b = { tokens: this.burst, updated: now };
      this.buckets.set(key, b);
    }
    const elapsed = (now - b.updated) / 1000;
    b.tokens = Math.min(this.burst, b.tokens + elapsed * this.ratePerSec);
    b.updated = now;
    if (b.tokens < cost) return false;
    b.tokens -= cost;
    return true;
  }
}
