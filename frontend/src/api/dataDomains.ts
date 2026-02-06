export type DataDomainRow = {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
};

export type DataDomainNode = {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
  children: DataDomainNode[];
};

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ""}`);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function listDataDomains(): Promise<DataDomainRow[]> {
  return jsonFetch<DataDomainRow[]>("/data-domains");
}

export function buildDomainTree(rows: DataDomainRow[]): DataDomainNode[] {
  const byId = new Map<string, DataDomainNode>();
  for (const r of rows) {
    byId.set(r.id, { ...r, children: [] });
  }

  const roots: DataDomainNode[] = [];
  for (const n of byId.values()) {
    if (!n.parent_id) {
      roots.push(n);
      continue;
    }
    const parent = byId.get(n.parent_id);
    if (parent) parent.children.push(n);
    else roots.push(n);
  }

  function sortRec(list: DataDomainNode[]) {
    list.sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
    );
    for (const n of list) sortRec(n.children);
  }
  sortRec(roots);

  return roots;
}
