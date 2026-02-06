import type { DatatrafikLegendItem } from "@/components/flows/DatatrafikPanel";
import { colorForCategory } from "@/components/graph/colors";

export function buildDatatrafikLegend(
  visibleCategoryIds: string[],
  categoryNameCache: Map<string, string>
): DatatrafikLegendItem[] {
  const legend: DatatrafikLegendItem[] = visibleCategoryIds.map((id) => {
    const name =
      id === "__none__" ? "Okategoriserat" : categoryNameCache.get(id) ?? `Datakategori (${id.slice(0, 8)}…)`;
    return { id, name, color: colorForCategory(id) };
  });

  legend.sort((a, b) => {
    if (a.id === "__none__") return 1;
    if (b.id === "__none__") return -1;
    return a.name.localeCompare(b.name);
  });

  return legend;
}
