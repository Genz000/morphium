import { createHash } from "node:crypto";

import { drawMorphFrame } from "./morph-draw";
import { DEMO_FRAMES, starPath } from "./morph-default-assets";
import { normalizeFrames } from "./morph-normalize";
import { pathToSubpaths } from "./morph-path";
import { readMorphSettings } from "./morph-settings";
import { lastFrameWeight, shapeAtProgress, stageMap, type Rect } from "./morph-scene";
import type { MorphFrame } from "./morph-types";

/** Records Path2D commands so drawing can be fingerprinted in Node. */
class RecordingPath2D {
  readonly calls: unknown[] = [];
  moveTo(...a: number[]) { this.calls.push(["M", ...a]); }
  bezierCurveTo(...a: number[]) { this.calls.push(["C", ...a.map((v) => +v.toFixed(4))]); }
  closePath() { this.calls.push(["Z"]); }
  toJSON() { return this.calls; }
}
(globalThis as { Path2D?: unknown }).Path2D ??= RecordingPath2D;

/** The demo frames built from path data (DOMParser is unavailable in Node). */
export const demoFrames: MorphFrame[] = [
  { name: "circle.svg", viewBox: [0, 0, 400, 400], subs: pathToSubpaths("M320 200A120 120 0 0 1 200 320A120 120 0 0 1 80 200A120 120 0 0 1 200 80A120 120 0 0 1 320 200Z") },
  { name: "star.svg", viewBox: [0, 0, 400, 400], subs: pathToSubpaths(starPath(200, 210, 150, 62, 5)) },
  { name: "blob.svg", viewBox: [0, 0, 400, 400], subs: pathToSubpaths(/d="([^"]+)"/.exec(DEMO_FRAMES[2][1])![1]) },
  {
    name: "ring.svg", viewBox: [0, 0, 400, 400],
    subs: [
      ...pathToSubpaths("M128 80H272A48 48 0 0 1 320 128V272A48 48 0 0 1 272 320H128A48 48 0 0 1 80 272V128A48 48 0 0 1 128 80Z"),
      ...pathToSubpaths("M260 200A60 60 0 0 1 200 260A60 60 0 0 1 140 200A60 60 0 0 1 200 140A60 60 0 0 1 260 200Z"),
    ],
  },
];

/** Mid-morph between frame 1 and 2 with the default 30% hold. */
export const MID_MORPH = 0.15;
export const FRAME: Rect = { x: -960, y: -540, width: 1920, height: 1080 };

export function recordingContext() {
  const calls: unknown[] = [];
  const context = new Proxy({}, {
    set: (_t, key, value) => { calls.push([key, value]); return true; },
    get: (_t, key) => (...args: unknown[]) => { calls.push([key, ...args]); return { width: 10 }; },
  }) as CanvasRenderingContext2D;
  return { context, calls };
}

/** Fingerprint of the export drawing for one set of values at one loop progress. */
export function drawSignature(
  values: Readonly<Record<string, unknown>>,
  { progress = MID_MORPH, frame = FRAME, frames = demoFrames, overlays = true } = {},
) {
  const settings = readMorphSettings(values);
  const norm = normalizeFrames(frames, settings.fit);
  const { shape, phase } = shapeAtProgress(norm, progress, settings);
  const { context, calls } = recordingContext();
  const background = String(values["appearance.background"] ?? "#F4F1EA");
  drawMorphFrame(context, shape, stageMap(frames[0].viewBox, frame), settings, background, Math.min(frame.width, frame.height) / 600, overlays && (values["overlay.export"] === undefined || settings.overlayExport), lastFrameWeight(phase, norm.length));
  return createHash("sha256").update(JSON.stringify(calls)).digest("hex");
}
