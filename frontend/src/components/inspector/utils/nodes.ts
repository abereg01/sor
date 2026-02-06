import type { GraphNode } from "@/api/types";

export function nodeById(nodes: GraphNode[]) {
  return new Map(nodes.map((n) => [n.id, n] as const));
}

export function nodeName(nodes: GraphNode[], id: string) {
  return nodes.find((n) => n.id === id)?.name ?? id;
}
