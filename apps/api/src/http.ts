const DEFAULT_UA =
  process.env.MAP_USER_AGENT ??
  "Hexwebmap/1.0 (https://github.com/Andyccr/Hexwebmap; atlas@localhost)";

export async function fetchJson<T>(
  url: string,
  opts: { timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 8_000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": DEFAULT_UA,
        ...opts.headers,
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`upstream ${res.status}: ${text.slice(0, 180)}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}
