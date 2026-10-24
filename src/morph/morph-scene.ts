import { resolveEasing } from "./morph-easing";
import { lerpShape } from "./morph-normalize";
import { phaseAt, type MorphPhase } from "./morph-sequence";
import type { MorphSettings } from "./morph-settings";
import type { CubicSegment, Subpath, ViewBox } from "./morph-types";

export type Rect = { x: number; y: number; width: number; height: number };

/** Maps frame-1 coordinates into the product rect: contained and centred, like the original stage. */
export type StageMap = { s: number; ox: number; oy: number };

export function stageMap(viewBox: ViewBox, rect: Rect): StageMap {
  const s = Math.min(rect.width / viewBox[2], rect.height / viewBox[3]);
  return {
    s,
    ox: rect.x + (rect.width - viewBox[2] * s) / 2 - viewBox[0] * s,
    oy: rect.y + (rect.height - viewBox[3] * s) / 2 - viewBox[1] * s,
  };
}

export function shapeAtProgress(norm: readonly Subpath[][], progress: number, settings: MorphSettings): { shape: readonly Subpath[]; phase: MorphPhase } {
  const ease = resolveEasing(settings.easing, settings.curve);
  const phase = phaseAt(progress, norm.length, settings.sequence, settings.hold, ease);
  if (!norm.length) return { shape: [], phase };
  const shape = phase.raw === 0 ? norm[phase.a] : lerpShape(norm[phase.a], norm[phase.b], phase.p);
  return { shape, phase };
}

/** Path data in frame-1 coordinates. */
export function pathData(shape: readonly Subpath[], precision = 3): string {
  const r = (v: number) => +v.toFixed(precision);
  let d = "";
  for (const s of shape) {
    if (s.ghost) continue;
    d += `M${r(s.segs[0][0])} ${r(s.segs[0][1])}`;
    for (const g of s.segs) d += `C${r(g[2])} ${r(g[3])} ${r(g[4])} ${r(g[5])} ${r(g[6])} ${r(g[7])}`;
    if (s.closed) d += "Z";
  }
  return d;
}

const isStraight = (g: CubicSegment) => {
  const dx = g[6] - g[0], dy = g[7] - g[1], L = Math.hypot(dx, dy);
  if (L < 1e-9) return Math.hypot(g[2] - g[0], g[3] - g[1]) < 1e-9 && Math.hypot(g[4] - g[6], g[5] - g[7]) < 1e-9;
  const d1 = Math.abs((g[2] - g[0]) * dy - (g[3] - g[1]) * dx) / L;
  const d2 = Math.abs((g[4] - g[0]) * dy - (g[5] - g[1]) * dx) / L;
  return d1 < L * 1e-3 && d2 < L * 1e-3;
};

export type Overlay = {
  anchors: [number, number][];
  /** anchor x, anchor y, control x, control y */
  handles: [number, number, number, number][];
};

/** Anchors and visible handles. Straight segments (lines stored as cubics) show no handles. */
export function overlayGeometry(shape: readonly Subpath[], minHandleLength = 1e-6): Overlay {
  const anchors: Overlay["anchors"] = [];
  const handles: Overlay["handles"] = [];
  for (const sub of shape) {
    if (sub.ghost) continue;
    sub.segs.forEach((g, i) => {
      anchors.push([g[0], g[1]]);
      if (!sub.closed && i === sub.segs.length - 1) anchors.push([g[6], g[7]]);
      if (isStraight(g)) return;
      if (Math.hypot(g[2] - g[0], g[3] - g[1]) > minHandleLength) handles.push([g[0], g[1], g[2], g[3]]);
      if (Math.hypot(g[4] - g[6], g[5] - g[7]) > minHandleLength) handles.push([g[6], g[7], g[4], g[5]]);
    });
  }
  return { anchors, handles };
}

export function formatCoordinate(v: number, decimals: number) {
  const r = v.toFixed(decimals);
  return /^-0(\.0+)?$/.test(r) ? r.slice(1) : r;
}

export const showsAnchorLabels = (s: MorphSettings) => s.labels === "anchors" || s.labels === "both";
export const showsHandleLabels = (s: MorphSettings) => s.handles && (s.labels === "handles" || s.labels === "both");

export function contrastInk(hex: string) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 140 ? "#111111" : "#F2F2F2";
}

/** How one copy of the path is painted. */
export type PaintStyle = { outline: boolean; fillOn: boolean; fill: string; stroke: string; strokeWidth: number };

export const baseStyle = (s: MorphSettings): PaintStyle =>
  ({ outline: s.outline, fillOn: s.fillOn, fill: s.fill, stroke: s.stroke, strokeWidth: s.strokeWidth });

/** The last frame's own look, or null when it uses the shared style. */
export function lastFrameStyle(s: MorphSettings): PaintStyle | null {
  if (!s.lastOn) return null;
  return s.lastStyle === "outline"
    ? { outline: true, fillOn: false, fill: s.lastFill, stroke: s.stroke, strokeWidth: 0 }
    : { outline: false, fillOn: true, fill: s.lastFill, stroke: s.stroke, strokeWidth: 0 };
}

/**
 * How much of the current shape is the last frame: 1 while resting on it, 0 on
 * any other frame, and the eased morph amount while moving into or out of it.
 * The last-frame style fades in and out by this weight.
 */
export function lastFrameWeight(phase: MorphPhase, frameCount: number): number {
  if (frameCount < 2) return 0;
  const last = frameCount - 1;
  const p = Math.min(Math.max(phase.p, 0), 1);
  return (phase.a === last ? 1 - p : 0) + (phase.b === last ? p : 0);
}

/**
 * Overlay visibility (0..1) for anchors and handles. Hiding them on the last
 * frame fades them out by the same weight as the last-frame style.
 */
export function overlayOpacity(s: MorphSettings, lastWeight: number): { anchors: number; handles: number } {
  const w = s.lastOn ? lastWeight : 0;
  return { anchors: s.lastAnchors ? 1 : 1 - w, handles: s.lastHandles ? 1 : 1 - w };
}
