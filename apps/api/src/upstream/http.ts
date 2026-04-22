export class UpstreamError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryAfterS?: number,
  ) {
    super(message);
  }
}

const UA = "latam-mcp/0.0.0 (+https://latam-mcp.com)";
const DEFAULT_TIMEOUT_MS = 8000;

export async function fetchJson<T = unknown>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), init.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      headers: { "user-agent": UA, accept: "application/json", ...(init.headers ?? {}) },
      signal: ctl.signal,
    });
    if (!res.ok) {
      const retryAfter = Number(res.headers.get("retry-after") ?? 0) || undefined;
      throw new UpstreamError(`upstream ${res.status}`, res.status, retryAfter);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof UpstreamError) throw err;
    if ((err as { name?: string }).name === "AbortError") {
      throw new UpstreamError("upstream timeout", 504);
    }
    throw new UpstreamError(`upstream network error: ${(err as Error).message}`, 502);
  } finally {
    clearTimeout(timer);
  }
}
