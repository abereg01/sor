export type ApiError = Error & {
  status?: number;
  body?: string;
};

const DEFAULT_BASE = "/api";
const API_BASE: string = (import.meta as any)?.env?.VITE_API_BASE ?? DEFAULT_BASE;

function joinUrl(base: string, path: string) {
  const b = base.endsWith("/") ? base.slice(0, -1) : base;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

async function readTextSafe(res: Response) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { ifMatch?: string }
): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }
  if (init?.ifMatch) headers.set("If-Match", init.ifMatch);

  const url = joinUrl(API_BASE, path);

  const res = await fetch(url, {
    ...init,
    headers,
  });

  if (!res.ok) {
    const body = await readTextSafe(res);
    const err: ApiError = new Error(body || `API error ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }

  if (res.status === 204) return undefined as unknown as T;
  const ct = res.headers.get("content-type") || "";

  if (!ct.includes("application/json")) {
    const body = await readTextSafe(res);
    const preview = body.slice(0, 200);
    const err: ApiError = new Error(
      `Expected JSON from ${url}, got "${ct || "unknown"}". Body starts with: ${JSON.stringify(preview)}`
    );
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return (await res.json()) as T;
}
