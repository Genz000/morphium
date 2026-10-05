import type { MorphSettings } from "./morph-settings";
import {
  contrastInk, formatCoordinate, overlayGeometry, showsAnchorLabels, showsHandleLabels, type StageMap,
} from "./morph-scene";
import type { Subpath } from "./morph-types";

function buildPath(shape: readonly Subpath[]) {
  const p = new Path2D();
  for (const s of shape) {
    if (s.ghost) continue;
    p.moveTo(s.segs[0][0], s.segs[0][1]);
    for (const g of s.segs) p.bezierCurveTo(g[2], g[3], g[4], g[5], g[6], g[7]);
    if (s.closed) p.closePath();
  }
  return p;
}

/**
 * Draws one frame for image and video export. `ui` scales point and label sizes
 * so overlays keep the same proportion to the artwork at any output resolution.
 */
export function drawMorphFrame(
  ctx: CanvasRenderingContext2D, shape: readonly Subpath[], map: StageMap, settings: MorphSettings,
  background: string, ui: number, includeOverlays: boolean,
) {
  const path = buildPath(shape);
  ctx.save();
  ctx.transform(map.s, 0, 0, map.s, map.ox, map.oy);
  ctx.lineJoin = settings.lineJoin;
  ctx.lineCap = "round";
  ctx.miterLimit = 8;
  if (settings.outline) {
    ctx.strokeStyle = contrastInk(background);
    ctx.lineWidth = ui / map.s;
    ctx.stroke(path);
  } else {
    if (settings.fillOn) { ctx.fillStyle = settings.fill; ctx.fill(path, "evenodd"); }
    if (settings.strokeWidth > 0) { ctx.strokeStyle = settings.stroke; ctx.lineWidth = settings.strokeWidth; ctx.stroke(path); }
  }
  ctx.restore();
  if (includeOverlays) drawOverlays(ctx, shape, map, settings, ui);
}

function drawOverlays(ctx: CanvasRenderingContext2D, shape: readonly Subpath[], map: StageMap, settings: MorphSettings, ui: number) {
  const X = (x: number) => x * map.s + map.ox, Y = (y: number) => y * map.s + map.oy;
  const { anchors, handles } = overlayGeometry(shape, 0.5 / map.s);
  const ps = settings.pointSize * ui;
  ctx.save();
  if (settings.handles) {
    ctx.strokeStyle = settings.handleColor; ctx.globalAlpha = 0.75; ctx.lineWidth = ui;
    ctx.beginPath();
    for (const h of handles) { ctx.moveTo(X(h[0]), Y(h[1])); ctx.lineTo(X(h[2]), Y(h[3])); }
    ctx.stroke();
    ctx.globalAlpha = 1; ctx.fillStyle = settings.handleColor;
    ctx.beginPath();
    for (const h of handles) { ctx.moveTo(X(h[2]) + ps * 0.75, Y(h[3])); ctx.arc(X(h[2]), Y(h[3]), ps * 0.75, 0, 2 * Math.PI); }
    ctx.fill();
  }
  if (settings.anchors) {
    ctx.fillStyle = "#FFFFFF"; ctx.strokeStyle = settings.anchorColor; ctx.lineWidth = 1.5 * ui;
    for (const [ax, ay] of anchors) {
      ctx.fillRect(X(ax) - ps, Y(ay) - ps, ps * 2, ps * 2);
      ctx.strokeRect(X(ax) - ps, Y(ay) - ps, ps * 2, ps * 2);
    }
  }
  const fs = settings.labelSize * ui;
  ctx.font = `500 ${fs}px "JetBrains Mono", ui-monospace, monospace`;
  ctx.textBaseline = "middle";
  const label = (x: number, y: number, color: string) => {
    const text = `${formatCoordinate(x, settings.decimals)}, ${formatCoordinate(y, settings.decimals)}`;
    const w = ctx.measureText(text).width, padX = 4 * ui, h = fs + 5 * ui;
    const lx = X(x) + ps + 4 * ui, ly = Y(y) - ps - h / 2 - 2 * ui;
    ctx.fillStyle = "rgba(14,15,17,0.86)";
    ctx.beginPath(); ctx.roundRect(lx, ly - h / 2, w + padX * 2, h, 3 * ui); ctx.fill();
    ctx.fillStyle = color; ctx.fillText(text, lx + padX, ly + 0.5 * ui);
  };
  if (showsHandleLabels(settings)) for (const h of handles) label(h[2], h[3], settings.handleColor);
  if (showsAnchorLabels(settings)) for (const [ax, ay] of anchors) label(ax, ay, "#FFFFFF");
  ctx.restore();
}
