import { getAuthToken } from "./client";

export type NewNodePayload = {
  kind: string;
  name: string;
  metadata?: Record<string, any> | null;
};

export type NodeRow = {
  id: string;
  kind: string;
  name: string;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
};

function authHeader(): Record<string, string> {
  const token = getAuthToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

function apiOrigin(): string {
  const envAny: any = (import.meta as any).env ?? {};
  const v = (envAny.VITE_API_ORIGIN ??
    envAny.VITE_BACKEND_ORIGIN ??
    envAny.VITE_BACKEND ??
    "").trim();
  if (v) return v.replace(/\/$/, "");
  return "";
}

function apiUrl(path: string): string {
  if (!path) return path;
  if (!path.startsWith("/")) return path;
  const base = apiOrigin();
  return base ? `${base}${path}` : path;
}

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      ...authHeader(),
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err: any = new Error(text || `HTTP ${res.status}`);
    err.status = res.status;
    err.message = text || err.message;
    throw err;
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function tryFetchNodeEtag(
  id: string,
  includeDeleted: boolean,
): Promise<string | null> {
  const qs = new URLSearchParams();
  if (includeDeleted) qs.set("include_deleted", "true");
  const q = qs.toString();
  const url = `/api/nodes/${id}${q ? `?${q}` : ""}`;

  const res = await fetch(apiUrl(url), {
    method: "GET",
    headers: { ...authHeader() },
  });
  if (!res.ok) return null;
  const etag = res.headers.get("ETag") ?? res.headers.get("Etag");
  return etag ? etag : null;
}

function sanitizeEtag(etag?: string | null): string | null {
  const raw = (etag ?? "").trim();
  if (!raw) return null;

  const noWeak = raw.startsWith("W/") ? raw.slice(2).trim() : raw;
  const noQuotes = noWeak.replace(/^"/, "").replace(/"$/, "").trim();
  if (!noQuotes) return null;

  return `"${noQuotes}"`;
}

export function listNodes(opts?: {
  includeDeleted?: boolean;
}): Promise<NodeRow[]> {
  const qs = new URLSearchParams();
  if (opts?.includeDeleted) qs.set("include_deleted", "true");
  const q = qs.toString();
  return jsonFetch<NodeRow[]>(`/api/nodes${q ? `?${q}` : ""}`);
}

export async function restoreNode(
  id: string,
  opts?: { ifMatch?: string | null },
): Promise<NodeRow> {
  const explicit = sanitizeEtag(opts?.ifMatch);

  const etag =
    explicit ||
    sanitizeEtag(await tryFetchNodeEtag(id, true)) ||
    sanitizeEtag(await tryFetchNodeEtag(id, false));

  if (!etag) {
    const err: any = new Error(
      "Kunde inte hämta If-Match/ETag för nod (krävs för återställning)",
    );
    err.status = 400;
    throw err;
  }

  return jsonFetch<NodeRow>(`/api/nodes/${id}/restore`, {
    method: "POST",
    headers: {
      "If-Match": etag,
      ...authHeader(),
    },
  });
}

export async function updateNode(
  id: string,
  patch: Record<string, any>,
  opts?: { ifMatch?: string },
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...authHeader(),
  };

  if (opts?.ifMatch) headers["If-Match"] = opts.ifMatch;

  const res = await fetch(apiUrl(`/api/nodes/${id}`), {
    method: "PATCH",
    headers,
    body: JSON.stringify(patch),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err: any = new Error(text || "Kunde inte uppdatera objekt");
    err.status = res.status;
    err.message = text || err.message;
    throw err;
  }

  return res.json().catch(() => ({}));
}

export async function createNode(payload: NewNodePayload) {
  const res = await fetch(apiUrl("/api/nodes"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Kunde inte skapa objekt");
  }

  return res.json();
}
