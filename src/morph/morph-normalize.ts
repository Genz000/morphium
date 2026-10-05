import { applyMatrix, bbox, cloneSubpaths } from "./morph-path";
import type { CubicSegment, FitMode, MorphFrame, Subpath, ViewBox } from "./morph-types";

export function pointAt(g: CubicSegment, t: number): [number, number] {
  const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [a * g[0] + b * g[2] + c * g[4] + d * g[6], a * g[1] + b * g[3] + c * g[5] + d * g[7]];
}

export function signedArea(sub: Subpath): number {
  let area = 0;
  for (const g of sub.segs) {
    let px = g[0], py = g[1];
    for (let k = 1; k <= 4; k++) {
      const [x, y] = pointAt(g, k / 4);
      area += px * y - x * py;
      px = x; py = y;
    }
  }
  return area / 2;
}

function centroid(sub: Subpath): [number, number] {
  let x = 0, y = 0;
  for (const g of sub.segs) { x += g[0]; y += g[1]; }
  return [x / sub.segs.length, y / sub.segs.length];
}

function reverse(sub: Subpath) {
  sub.segs = sub.segs.slice().reverse().map((g) => [g[6], g[7], g[4], g[5], g[2], g[3], g[0], g[1]]);
}

export function splitSegment(g: CubicSegment, t: number): [CubicSegment, CubicSegment] {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = g;
  const L = (a: number, b: number) => a + (b - a) * t;
  const ax = L(x0, x1), ay = L(y0, y1), bx = L(x1, x2), by = L(y1, y2), cx = L(x2, x3), cy = L(y2, y3);
  const dx = L(ax, bx), dy = L(ay, by), ex = L(bx, cx), ey = L(by, cy);
  const fx = L(dx, ex), fy = L(dy, ey);
  return [[x0, y0, ax, ay, dx, dy, fx, fy], [fx, fy, ex, ey, cx, cy, x3, y3]];
}

const segmentLength = (g: CubicSegment) =>
  Math.hypot(g[2] - g[0], g[3] - g[1]) + Math.hypot(g[4] - g[2], g[5] - g[3]) + Math.hypot(g[6] - g[4], g[7] - g[5]);

/** Adds anchors until the subpath has `count` segments, spread by length, cut at equal t. */
export function subdivide(sub: Subpath, count: number) {
  const n = sub.segs.length;
  if (n >= count) return;
  const lengths = sub.segs.map((g) => segmentLength(g) + 1e-9);
  const total = lengths.reduce((a, b) => a + b, 0);
  const pieces = lengths.map((l) => Math.max(1, Math.floor((l / total) * count)));
  let left = count - pieces.reduce((a, b) => a + b, 0);
  const order = lengths.map((l, i) => [(l / total) * count - pieces[i], i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; left > 0; k = (k + 1) % n, left--) pieces[order[k][1]]++;
  for (let k = n - 1; left < 0; k = (k - 1 + n) % n) {
    if (pieces[order[k][1]] > 1) { pieces[order[k][1]]--; left++; }
  }
  const out: CubicSegment[] = [];
  sub.segs.forEach((g, i) => {
    let rest = g;
    for (let m = pieces[i]; m > 1; m--) { const [a, b] = splitSegment(rest, 1 / m); out.push(a); rest = b; }
    out.push(rest);
  });
  sub.segs = out;
}

function ghost(x: number, y: number, count: number): Subpath {
  return { closed: true, ghost: true, segs: Array.from({ length: count }, () => [x, y, x, y, x, y, x, y] as CubicSegment) };
}

/** Places every frame in frame 1's coordinates: by viewBox, or by artwork bounds. */
export function fitFrames(frames: readonly MorphFrame[], mode: FitMode): Subpath[][] {
  const ref: ViewBox = mode === "content" ? bbox(frames[0].subs) : frames[0].viewBox;
  return frames.map((frame, i) => {
    const subs = cloneSubpaths(frame.subs);
    if (i === 0) return subs;
    const box = mode === "content" ? bbox(subs) : frame.viewBox;
    const s = Math.min(ref[2] / box[2], ref[3] / box[3]);
    const tx = ref[0] + (ref[2] - box[2] * s) / 2 - box[0] * s;
    const ty = ref[1] + (ref[3] - box[3] * s) / 2 - box[1] * s;
    return applyMatrix(subs, [s, 0, 0, s, tx, ty]);
  });
}

/**
 * Gives every frame the same structure so points interpolate one-to-one:
 * matched subpaths, equal segment counts, ghosts for missing shapes and
 * closed-path starts rotated to line up with the previous frame.
 */
export function normalizeFrames(frames: readonly MorphFrame[], mode: FitMode): Subpath[][] {
  if (!frames.length) return [];
  const fitted = fitFrames(frames, mode);
  for (const subs of fitted) for (const s of subs) if (s.closed && signedArea(s) < 0) reverse(s);
  let refIndex = 0;
  fitted.forEach((subs, i) => { if (subs.length > fitted[refIndex].length) refIndex = i; });
  const area = (s: Subpath) => Math.abs(signedArea(s)) || segmentLength(s.segs[0]) * 1e-3;
  fitted[refIndex].sort((a, b) => area(b) - area(a));
  const ref = fitted[refIndex];
  const refBox = bbox(ref), diagonal = Math.hypot(refBox[2], refBox[3]);
  const refInfo = ref.map((s) => ({ c: centroid(s), a: area(s) }));

  const slotted = fitted.map((subs, fi) => {
    if (fi === refIndex) return subs.slice() as (Subpath | null)[];
    const pairs: [number, number, number][] = [];
    subs.forEach((s, i) => {
      const c = centroid(s), a = area(s);
      refInfo.forEach((q, j) => {
        const dist = Math.hypot(c[0] - q.c[0], c[1] - q.c[1]) / diagonal;
        pairs.push([dist * 2 + Math.abs(Math.log((a + 1e-9) / (q.a + 1e-9))) * 0.35, i, j]);
      });
    });
    pairs.sort((a, b) => a[0] - b[0]);
    const slots: (Subpath | null)[] = new Array(ref.length).fill(null);
    const used = new Set<number>();
    for (const [, i, j] of pairs) {
      if (slots[j] || used.has(i)) continue;
      slots[j] = subs[i]; used.add(i);
    }
    return slots;
  });

  const out: Subpath[][] = fitted.map(() => []);
  for (let k = 0; k < ref.length; k++) {
    let count = 4;
    for (const slots of slotted) if (slots[k]) count = Math.max(count, slots[k]!.segs.length);
    const column = slotted.map((slots) => {
      const s = slots[k];
      if (s) { subdivide(s, count); return s; }
      return ghost(refInfo[k].c[0], refInfo[k].c[1], count);
    });
    for (let fi = 1; fi < column.length; fi++) alignStart(column[fi - 1], column[fi]);
    column.forEach((s, fi) => out[fi].push(s));
  }
  return out;
}

function alignStart(a: Subpath, b: Subpath) {
  if (!a.closed || !b.closed || b.ghost) return;
  const n = b.segs.length;
  let best = 0, bestCost = Infinity;
  for (let r = 0; r < n; r++) {
    let cost = 0;
    for (let i = 0; i < n && cost < bestCost; i++) {
      const p = a.segs[i], q = b.segs[(i + r) % n];
      cost += (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
    }
    if (cost < bestCost) { bestCost = cost; best = r; }
  }
  if (best) b.segs = b.segs.slice(best).concat(b.segs.slice(0, best));
}

export function lerpShape(A: readonly Subpath[], B: readonly Subpath[], t: number): Subpath[] {
  return A.map((a, k) => {
    const b = B[k];
    const segs = a.segs.map((p, i) => {
      const q = b.segs[i];
      return p.map((v, j) => v + (q[j] - v) * t) as CubicSegment;
    });
    const ghostNow = (a.ghost && b.ghost) || (a.ghost && t === 0) || (b.ghost && t === 1);
    return { closed: t < 0.5 ? a.closed : b.closed, segs, ...(ghostNow ? { ghost: true } : {}) };
  });
}
