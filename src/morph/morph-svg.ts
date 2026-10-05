import { applyMatrix, bbox, IDENTITY, multiply, parseTransform, pathToSubpaths } from "./morph-path";
import type { Matrix, MorphFrame, Subpath, ViewBox } from "./morph-types";
import { findById, parseXml, type XmlNode } from "./morph-xml";

const SKIP = new Set([
  "defs", "clipPath", "mask", "symbol", "marker", "pattern", "linearGradient", "radialGradient",
  "style", "title", "desc", "metadata", "text", "script", "filter", "foreignObject", "image",
]);
const SHAPES = new Set(["path", "rect", "circle", "ellipse", "line", "polyline", "polygon"]);

const attr = (el: XmlNode, name: string, fallback = 0) => {
  const v = parseFloat(el.attrs[name] ?? "");
  return Number.isFinite(v) ? v : fallback;
};

/** Basic shapes to path data so every element shares one parser. */
export function shapeToPathData(el: XmlNode): string {
  switch (el.name) {
    case "path": return el.attrs.d ?? "";
    case "rect": {
      const x = attr(el, "x"), y = attr(el, "y"), w = attr(el, "width"), h = attr(el, "height");
      if (w <= 0 || h <= 0) return "";
      let rx = "rx" in el.attrs ? attr(el, "rx") : null;
      let ry = "ry" in el.attrs ? attr(el, "ry") : null;
      if (rx === null) rx = ry ?? 0;
      if (ry === null) ry = rx;
      rx = Math.min(rx, w / 2); ry = Math.min(ry, h / 2);
      if (!rx || !ry) return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
      return `M${x + rx} ${y}H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}V${y + h - ry}A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`;
    }
    case "circle": case "ellipse": {
      const cx = attr(el, "cx"), cy = attr(el, "cy");
      const rx = el.name === "circle" ? attr(el, "r") : attr(el, "rx");
      const ry = el.name === "circle" ? rx : attr(el, "ry");
      if (rx <= 0 || ry <= 0) return "";
      return `M${cx + rx} ${cy}A${rx} ${ry} 0 0 1 ${cx} ${cy + ry}A${rx} ${ry} 0 0 1 ${cx - rx} ${cy}A${rx} ${ry} 0 0 1 ${cx} ${cy - ry}A${rx} ${ry} 0 0 1 ${cx + rx} ${cy}Z`;
    }
    case "line": return `M${attr(el, "x1")} ${attr(el, "y1")}L${attr(el, "x2")} ${attr(el, "y2")}`;
    case "polyline": case "polygon": {
      const p = (el.attrs.points ?? "").trim().split(/[\s,]+/).map(Number).filter(Number.isFinite);
      if (p.length < 4) return "";
      let d = `M${p[0]} ${p[1]}`;
      for (let i = 2; i + 1 < p.length; i += 2) d += `L${p[i]} ${p[i + 1]}`;
      return el.name === "polygon" ? `${d}Z` : d;
    }
    default: return "";
  }
}

const isHidden = (el: XmlNode) =>
  el.attrs.display === "none" || el.attrs.visibility === "hidden" || /display\s*:\s*none/.test(el.attrs.style ?? "");

/** Parses SVG text into cubic subpaths in its own coordinates, transforms applied. */
export function parseSvgFrame(text: string, name: string): MorphFrame {
  const doc = parseXml(text);
  if (!doc) throw new Error(`${name}: not a valid SVG file`);
  const root = doc.nodes[doc.root];
  const kids = (node: XmlNode) => node.children.map((index) => doc.nodes[index]);
  const subs: Subpath[] = [];
  const walk = (children: readonly XmlNode[], m: Matrix, depth: number) => {
    if (depth > 40) return;
    for (const child of children) {
      if (SKIP.has(child.name) || isHidden(child)) continue;
      let cm = multiply(m, parseTransform(child.attrs.transform ?? null));
      if (SHAPES.has(child.name)) {
        const d = shapeToPathData(child);
        if (d) subs.push(...applyMatrix(pathToSubpaths(d), cm));
      } else if (child.name === "use") {
        const href = child.attrs.href ?? child.attrs["xlink:href"] ?? "";
        const ref = href.startsWith("#") ? findById(doc, href.slice(1)) : null;
        if (ref) {
          cm = multiply(cm, [1, 0, 0, 1, attr(child, "x"), attr(child, "y")]);
          walk(ref.name === "symbol" ? kids(ref) : [ref], cm, depth + 1);
        }
      } else if (child.name === "svg") {
        walk(kids(child), multiply(cm, [1, 0, 0, 1, attr(child, "x"), attr(child, "y")]), depth + 1);
      } else {
        walk(kids(child), cm, depth + 1);
      }
    }
  };
  walk(kids(root), IDENTITY, 0);
  return { name, subs, viewBox: readViewBox(root, subs) };
}

function readViewBox(root: XmlNode, subs: Subpath[]): ViewBox {
  const vb = (root.attrs.viewBox ?? "").trim().split(/[\s,]+/).map(Number);
  if (vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0) return [vb[0], vb[1], vb[2], vb[3]];
  const w = parseFloat(root.attrs.width ?? ""), h = parseFloat(root.attrs.height ?? "");
  if (w > 0 && h > 0) return [0, 0, w, h];
  const b = bbox(subs), pad = Math.max(b[2], b[3]) * 0.05;
  return [b[0] - pad, b[1] - pad, b[2] + 2 * pad, b[3] + 2 * pad];
}
