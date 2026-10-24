import type { MorphSettings } from "./morph-settings";
import {
  baseStyle, contrastInk, formatCoordinate, lastFrameStyle, overlayOpacity, type PaintStyle, overlayGeometry, showsAnchorLabels, showsHandleLabels, type StageMap,
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
  background: string, ui: number, includeOverlays: boolean, lastWeight = 0,
) {
  const path = buildPath(shape);
  ctx.save();
  ctx.transform(map.s, 0, 0, map.s, map.ox, map.oy);
  ctx.lineJoin = settings.lineJoin;
  ctx.lineCap = "round";
  ctx.miterLimit = 8;
  const last = lastFrameStyle(settings);
  const weight = last ? lastWeight : 0;
  if (weight < 1) paint(ctx, path, baseStyle(settings), 1 - weight, background, ui / map.s);
  if (last && weight > 0) paint(ctx, path, last, weight, background, ui / map.s);
  ctx.restore();
  if (includeOverlays) drawOverlays(ctx, shape, map, settings, ui, overlayOpacity(settings, weight));
}

function paint(ctx: CanvasRenderingContext2D, path: Path2D, style: PaintStyle, alpha: number, background: string, hairline: number) {
  ctx.globalAlpha = alpha;
  if (style.outline) {
    ctx.strokeStyle = contrastInk(background);
    ctx.lineWidth = hairline;
    ctx.stroke(path);
  } else {
    if (style.fillOn) { ctx.fillStyle = style.fill; ctx.fill(path, "evenodd"); }
    if (style.strokeWidth > 0) { ctx.strokeStyle = style.stroke; ctx.lineWidth = style.strokeWidth; ctx.stroke(path); }
  }
  ctx.globalAlpha = 1;
}

function drawOverlays(
  ctx: CanvasRenderingContext2D, shape: readonly Subpath[], map: StageMap, settings: MorphSettings, ui: number,
  opacity: { anchors: number; handles: number },
) {
  const X = (x: number) => x * map.s + map.ox, Y = (y: number) => y * map.s + map.oy;
  const { anchors, handles } = overlayGeometry(shape, 0.5 / map.s);
  const ps = settings.pointSize * ui;
  ctx.save();
  if (settings.handles && opacity.handles > 0) {
    ctx.strokeStyle = settings.handleColor; ctx.globalAlpha = 0.75 * opacity.handles; ctx.lineWidth = ui;
    ctx.beginPath();
    for (const h of handles) { ctx.moveTo(X(h[0]), Y(h[1])); ctx.lineTo(X(h[2]), Y(h[3])); }
    ctx.stroke();
    ctx.globalAlpha = opacity.handles; ctx.fillStyle = settings.handleColor;
    ctx.beginPath();
    for (const h of handles) { ctx.moveTo(X(h[2]) + ps * 0.75, Y(h[3])); ctx.arc(X(h[2]), Y(h[3]), ps * 0.75, 0, 2 * Math.PI); }
    ctx.fill();
  }
  if (settings.anchors && opacity.anchors > 0) {
    ctx.globalAlpha = opacity.anchors;
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
  ctx.globalAlpha = opacity.handles;
  if (showsHandleLabels(settings) && opacity.handles > 0) for (const h of handles) label(h[2], h[3], settings.handleColor);
  ctx.globalAlpha = opacity.anchors;
  if (showsAnchorLabels(settings) && opacity.anchors > 0) for (const [ax, ay] of anchors) label(ax, ay, "#FFFFFF");
  ctx.globalAlpha = 1;
  ctx.restore();
}

/**
 * The editor workspace drawn into exports: its fill, then the "Dots" grid of
 * 3 px dots every 24 px (scene units at 100% zoom), anchored to the scene
 * origin like the editor, in the foreground ink at 10% opacity.
 */
export function drawWorkspace(
  ctx: CanvasRenderingContext2D, frame: { x: number; y: number; width: number; height: number },
  workspace: { background: string; dots: string }, dots: boolean,
) {
  ctx.save();
  ctx.fillStyle = workspace.background;
  ctx.fillRect(frame.x, frame.y, frame.width, frame.height);
  ctx.restore();
  if (dots) drawWorkspaceDots(ctx, frame, workspace.dots);
}

export const EXPORT_DOT_OPACITY = 0.22;

function drawWorkspaceDots(ctx: CanvasRenderingContext2D, frame: { x: number; y: number; width: number; height: number }, dotColor: string) {
  // Same grid as the editor (24 px, anchored like the canvas). Dots are drawn a little larger and
  // stronger than the on-screen 10% so they survive video compression and players that crush
  // the darkest tones; at 10% they vanished in H.265 MP4 playback.
  const gap = 24, radius = 1.75, phase = 11.5;
  const startX = Math.ceil((frame.x + phase) / gap) * gap - phase;
  const startY = Math.ceil((frame.y + phase) / gap) * gap - phase;
  ctx.save();
  ctx.fillStyle = dotColor;
  ctx.globalAlpha = EXPORT_DOT_OPACITY;
  ctx.beginPath();
  for (let y = startY; y < frame.y + frame.height + radius; y += gap) {
    for (let x = startX; x < frame.x + frame.width + radius; x += gap) {
      ctx.moveTo(x + radius, y);
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
    }
  }
  ctx.fill();
  ctx.restore();
}
