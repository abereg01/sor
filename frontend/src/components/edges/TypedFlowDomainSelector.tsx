import { useMemo } from "react";
import type { DataDomainNode } from "@/api/dataDomains";

type Props = {
  tree: DataDomainNode[];
  selectedIds: string[];
  onChange: (nextSelectedIds: string[]) => void;
};

function collectDescendants(node: DataDomainNode): string[] {
  const out: string[] = [];
  const stack: DataDomainNode[] = [...node.children];
  while (stack.length) {
    const n = stack.pop()!;
    out.push(n.id);
    for (const c of n.children) stack.push(c);
  }
  return out;
}

export function TypedFlowDomainSelector({ tree, selectedIds, onChange }: Props) {
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  function toggleNode(node: DataDomainNode, checked: boolean) {
    const next = new Set(selected);
    if (checked) {
      next.add(node.id);
    } else {
      next.delete(node.id);
      for (const id of collectDescendants(node)) next.delete(id);
    }
    onChange(Array.from(next));
  }

  function renderNode(node: DataDomainNode, depth: number) {
    const isChecked = selected.has(node.id);

    return (
      <div key={node.id} style={{ paddingLeft: depth * 14, display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input type="checkbox" checked={isChecked} onChange={(e) => toggleNode(node, e.target.checked)} />
          <span style={{ fontSize: 13 }}>{node.name}</span>
        </label>

        {isChecked && node.children.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {node.children.map((c) => renderNode(c, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  }

  return <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{tree.map((n) => renderNode(n, 0))}</div>;
}
