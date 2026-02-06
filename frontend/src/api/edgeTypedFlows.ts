export type FlowDirection = "fran" | "till" | "bidirectional";

export type EdgeTypedFlow = {
  direction: FlowDirection;
  domain_ids: string[];
};

export type PutEdgeTypedFlowsPayload = {
  flows: Array<{
    direction: FlowDirection;
    domain_ids: string[];
  }>;
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

export function getEdgeTypedFlows(edgeId: string): Promise<EdgeTypedFlow[]> {
  return jsonFetch<EdgeTypedFlow[]>(`/edges/${edgeId}/typed-flows`);
}

export function putEdgeTypedFlows(
  edgeId: string,
  payload: PutEdgeTypedFlowsPayload
): Promise<void> {
  return jsonFetch<void>(`/edges/${edgeId}/typed-flows`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
