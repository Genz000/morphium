import type { CubicSegment, Matrix, Subpath, ViewBox } from "./morph-types";

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

export const multiply = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];

const NUMBER = /[+-]?(?:\d*\.\d+|\d+\.?\d*)(?:e[+-]?\d+)?/gi;

export function parseTransform(source: string | null): Matrix {
  let m = IDENTITY;
  if (!source) return m;
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    const a = (match[2].match(NUMBER) ?? []).map(Number);
    let t: Matrix = IDENTITY;
    switch (match[1]) {
      case "matrix": if (a.length === 6) t = a as unknown as Matrix; break;
      case "translate": t = [1, 0, 0, 1, a[0] ?? 0, a[1] ?? 0]; break;
      case "scale": t = [a[0], 0, 0, a.length > 1 ? a[1] : a[0], 0, 0]; break;
      case "rotate": {
        const ang = ((a[0] ?? 0) * Math.PI) / 180, c = Math.cos(ang), s = Math.sin(ang);
        t = [c, s, -s, c, 0, 0];
        if (a.length === 3) t = multiply(multiply([1, 0, 0, 1, a[1], a[2]], t), [1, 0, 0, 1, -a[1], -a[2]]);
        break;
      }
      case "skewX": t = [1, 0, Math.tan(((a[0] ?? 0) * Math.PI) / 180), 1, 0, 0]; break;
      case "skewY": t = [1, Math.tan(((a[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0]; break;
    }
    m = multiply(m, t);
  }
  return m;
}

type PathCommand = { c: string; a: number[] };
const ARG_COUNTS: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

/** Tokenises path data. Arc flags are read as single characters so "a1 1 0 011 1" parses. */
export function parsePathData(d: string): PathCommand[] {
  const out: PathCommand[] = [];
  const numRe = /[+-]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][+-]?\d+)?/y;
  const n = d.length;
  let i = 0;
  let cmd: string | null = null;
  const skip = () => { while (i < n && /[\s,]/.test(d[i])) i++; };
  const num = () => { skip(); numRe.lastIndex = i; const m = numRe.exec(d); if (!m) return null; i = numRe.lastIndex; return parseFloat(m[0]); };
  const flag = () => { skip(); const c = d[i]; if (c === "0" || c === "1") { i++; return Number(c); } return null; };
  for (;;) {
    skip();
    if (i >= n) break;
    if (/[MmLlHhVvCcSsQqTtAaZz]/.test(d[i])) cmd = d[i++];
    else if (cmd === null) break;
    const upper = cmd.toUpperCase();
    const k = ARG_COUNTS[upper];
    if (k === 0) { out.push({ c: cmd, a: [] }); cmd = null; continue; }
    const args: number[] = [];
    for (let j = 0; j < k; j++) {
      const v = upper === "A" && (j === 3 || j === 4) ? flag() : num();
      if (v === null) break;
      args.push(v);
    }
    if (args.length < k) break;
    out.push({ c: cmd, a: args });
    if (cmd === "M") cmd = "L"; else if (cmd === "m") cmd = "l";
  }
  return out;
}

/** Endpoint arc to cubic beziers, split into quarter turns or less. */
export function arcToCubics(
  x1: number, y1: number, rx: number, ry: number, phi: number,
  fa: number, fs: number, x2: number, y2: number,
): number[][] | null {
  rx = Math.abs(rx); ry = Math.abs(ry);
  if (!rx || !ry) return null;
  const rad = (phi * Math.PI) / 180, cos = Math.cos(rad), sin = Math.sin(rad);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy, y1p = -sin * dx + cos * dy;
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) { const s = Math.sqrt(lam); rx *= s; ry *= s; }
  const rx2 = rx * rx, ry2 = ry * ry;
  const num = Math.max(0, rx2 * ry2 - rx2 * y1p * y1p - ry2 * x1p * x1p);
  const den = rx2 * y1p * y1p + ry2 * x1p * x1p;
  let coef = den ? Math.sqrt(num / den) : 0;
  if (fa === fs) coef = -coef;
  const cxp = (coef * rx * y1p) / ry, cyp = (-coef * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2, cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const angle = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!fs && dt > 0) dt -= 2 * Math.PI; else if (fs && dt < 0) dt += 2 * Math.PI;
  const segments = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2) - 1e-9));
  const d = dt / segments, k = (4 / 3) * Math.tan(d / 4);
  const P = (ux: number, uy: number) => [cx + cos * rx * ux - sin * ry * uy, cy + sin * rx * ux + cos * ry * uy];
  const out: number[][] = [];
  let t = t1;
  for (let s = 0; s < segments; s++) {
    const c1 = Math.cos(t), s1 = Math.sin(t), c2 = Math.cos(t + d), s2 = Math.sin(t + d);
    out.push([...P(c1 - k * s1, s1 + k * c1), ...P(c2 + k * s2, s2 - k * c2), ...P(c2, s2)]);
    t += d;
  }
  return out;
}

/** Path data to absolute cubic subpaths. Lines and quadratics become exact cubics. */
export function pathToSubpaths(d: string): Subpath[] {
  const subs: Subpath[] = [];
  let cur: Subpath | null = null;
  let x = 0, y = 0, sx = 0, sy = 0;
  let lastCubic: [number, number] | null = null, lastQuad: [number, number] | null = null;
  const start = (px: number, py: number) => { cur = { closed: false, segs: [] }; subs.push(cur); sx = px; sy = py; };
  const C = (a: number, b: number, c: number, e: number, f: number, g: number) => {
    if (!cur) start(x, y);
    cur!.segs.push([x, y, a, b, c, e, f, g]);
    x = f; y = g;
  };
  const L = (ex: number, ey: number) => C(x + (ex - x) / 3, y + (ey - y) / 3, x + (2 * (ex - x)) / 3, y + (2 * (ey - y)) / 3, ex, ey);
  for (const { c, a } of parsePathData(d)) {
    const rel = c === c.toLowerCase(), U = c.toUpperCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    let nextCubic: [number, number] | null = null, nextQuad: [number, number] | null = null;
    switch (U) {
      case "M": x = a[0] + ox; y = a[1] + oy; start(x, y); break;
      case "L": L(a[0] + ox, a[1] + oy); break;
      case "H": L(a[0] + ox, y); break;
      case "V": L(x, a[0] + oy); break;
      case "C": C(a[0] + ox, a[1] + oy, a[2] + ox, a[3] + oy, a[4] + ox, a[5] + oy); nextCubic = [a[2] + ox, a[3] + oy]; break;
      case "S": {
        const r = lastCubic ? [2 * x - lastCubic[0], 2 * y - lastCubic[1]] : [x, y];
        C(r[0], r[1], a[0] + ox, a[1] + oy, a[2] + ox, a[3] + oy);
        nextCubic = [a[0] + ox, a[1] + oy];
        break;
      }
      case "Q": case "T": {
        let qx: number, qy: number, ex: number, ey: number;
        if (U === "Q") { qx = a[0] + ox; qy = a[1] + oy; ex = a[2] + ox; ey = a[3] + oy; }
        else { [qx, qy] = lastQuad ? [2 * x - lastQuad[0], 2 * y - lastQuad[1]] : [x, y]; ex = a[0] + ox; ey = a[1] + oy; }
        C(x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), ex + (2 / 3) * (qx - ex), ey + (2 / 3) * (qy - ey), ex, ey);
        nextQuad = [qx, qy];
        break;
      }
      case "A": {
        const ex = a[5] + ox, ey = a[6] + oy;
        if (ex === x && ey === y) break;
        const cubics = arcToCubics(x, y, a[0], a[1], a[2], a[3], a[4], ex, ey);
        if (!cubics) L(ex, ey);
        else for (const s of cubics) C(s[0], s[1], s[2], s[3], s[4], s[5]);
        break;
      }
      case "Z": {
        const open = cur as Subpath | null;
        if (open) {
          if (Math.hypot(x - sx, y - sy) > 1e-6) L(sx, sy);
          const last = open.segs[open.segs.length - 1];
          if (last) { last[6] = sx; last[7] = sy; }
          open.closed = true;
        }
        x = sx; y = sy; cur = null;
        break;
      }
    }
    lastCubic = nextCubic; lastQuad = nextQuad;
  }
  return subs.filter((s) => s.segs.length > 0);
}

export function applyMatrix(subs: Subpath[], m: Matrix): Subpath[] {
  for (const s of subs) for (const g of s.segs) for (let i = 0; i < 8; i += 2) {
    const px = g[i], py = g[i + 1];
    g[i] = m[0] * px + m[2] * py + m[4];
    g[i + 1] = m[1] * px + m[3] * py + m[5];
  }
  return subs;
}

/** Bounding box of all anchors and controls (the control hull contains the curve). */
export function bbox(subs: readonly Subpath[]): ViewBox {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of subs) for (const g of s.segs) for (let i = 0; i < 8; i += 2) {
    x0 = Math.min(x0, g[i]); x1 = Math.max(x1, g[i]);
    y0 = Math.min(y0, g[i + 1]); y1 = Math.max(y1, g[i + 1]);
  }
  if (!Number.isFinite(x0)) return [0, 0, 1, 1];
  return [x0, y0, Math.max(x1 - x0, 1e-6), Math.max(y1 - y0, 1e-6)];
}

export const cloneSubpaths = (subs: readonly Subpath[]): Subpath[] =>
  subs.map((s) => ({ closed: s.closed, segs: s.segs.map((g) => g.slice() as CubicSegment) }));
