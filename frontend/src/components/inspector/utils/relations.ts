export function relationLabelSv(kind: string) {
  const k = String(kind || "");
  const map: Record<string, string> = {
    depends_on: "Beroende av",
    runs_on: "Körs på",
    stores_data: "Lagrar data i",
    flows_to: "Flödar till",
    owned_by: "Ägs av",
    external_dependency: "Externt beroende",
    backs_up_to: "Backar upp till",
  };
  return map[k] ?? "Koppling";
}
