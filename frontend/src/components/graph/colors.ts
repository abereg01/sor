import * as d3 from "d3";
import { hashStringToInt } from "@/components/graph/utils";

export function colorForCategory(id: string): string {
  const palette = d3.schemeObservable10 as unknown as string[];
  return palette[hashStringToInt(id) % palette.length];
}
