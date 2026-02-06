import * as d3 from "d3";

export function installGraphDefs(svg: d3.Selection<SVGSVGElement, unknown, null, undefined>) {
  svg.append("style").text(`
    @keyframes flowDashMoveFwd { to { stroke-dashoffset: -56; } }
    @keyframes flowDashMoveRev { to { stroke-dashoffset:  56; } }
  `);

  const defs = svg.append("defs");

  const nodeShadow = defs
    .append("filter")
    .attr("id", "nodeShadow")
    .attr("x", "-30%")
    .attr("y", "-30%")
    .attr("width", "160%")
    .attr("height", "160%");
  nodeShadow.append("feDropShadow").attr("dx", 0).attr("dy", 2).attr("stdDeviation", 2).attr("flood-color", "rgba(var(--rgb-black),0.18)");

  const flowShadow = defs
    .append("filter")
    .attr("id", "flowShadow")
    .attr("x", "-30%")
    .attr("y", "-30%")
    .attr("width", "160%")
    .attr("height", "160%");
  flowShadow.append("feDropShadow").attr("dx", 0).attr("dy", 1).attr("stdDeviation", 1.25).attr("flood-color", "rgba(var(--rgb-black),0.16)");

  const flowStripeFwd = defs
    .append("pattern")
    .attr("id", "flowStripeFwd")
    .attr("patternUnits", "userSpaceOnUse")
    .attr("width", 8)
    .attr("height", 8)
    .attr("patternTransform", "rotate(45)");
  flowStripeFwd.append("rect").attr("x", 0).attr("y", 0).attr("width", 6).attr("height", 8).attr("fill", "var(--graph-flow-stripe-a)");
  flowStripeFwd.append("rect").attr("x", 6).attr("y", 0).attr("width", 2).attr("height", 8).attr("fill", "var(--graph-flow-stripe-b)");

  const flowStripeRev = defs
    .append("pattern")
    .attr("id", "flowStripeRev")
    .attr("patternUnits", "userSpaceOnUse")
    .attr("width", 8)
    .attr("height", 8)
    .attr("patternTransform", "rotate(45)");
  flowStripeRev.append("rect").attr("x", 0).attr("y", 0).attr("width", 2).attr("height", 8).attr("fill", "var(--graph-flow-stripe-a)");
  flowStripeRev.append("rect").attr("x", 2).attr("y", 0).attr("width", 6).attr("height", 8).attr("fill", "var(--graph-flow-stripe-b)");
}
