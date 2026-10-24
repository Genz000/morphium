import type { CurveValue, EasingChoice } from "./morph-easing";
import type { CoordinateLabels, FitMode, LineJoin, SequenceMode } from "./morph-types";

export const FRAMES_TARGET = "frames.source";
export const MAX_FRAMES = 5;

/** Reference defaults from the original Morphium page. */
export const morphDefaults = {
  fit: "viewbox" as FitMode,
  sequence: "loop" as SequenceMode,
  delay: 500,
  duration: 1200,
  easing: "cubic-in-out" as EasingChoice,
  curve: { activeChannel: "RGB" as const, points: { RGB: [{ x: 0, y: 0 }, { x: 0.35, y: 0.08 }, { x: 0.65, y: 0.92 }, { x: 1, y: 1 }] } },
  outline: false,
  anchors: true,
  handles: true,
  labels: "off" as CoordinateLabels,
  decimals: "1",
  labelSize: 10,
  pointSize: 4,
  anchorColor: "#FF6A3D",
  handleColor: "#3DC2FF",
  overlayExport: false,
  exportDots: true,
  fillOn: true,
  fill: "#141414",
  stroke: "#FF6A3D",
  strokeWidth: 0,
  lineJoin: "round" as LineJoin,
  background: "#F4F1EA",
  lastOn: false,
  lastStyle: "fill" as "fill" | "outline",
  lastFill: "#FF6A3D",
  lastAnchors: true,
  lastHold: 0,
  lastHandles: true,
};

export type MorphSettings = {
  fit: FitMode; sequence: SequenceMode; delay: number; duration: number; hold: number; easing: string; curve: CurveValue;
  outline: boolean; anchors: boolean; handles: boolean; labels: CoordinateLabels; decimals: number;
  labelSize: number; pointSize: number; anchorColor: string; handleColor: string; overlayExport: boolean; exportDots: boolean;
  fillOn: boolean; fill: string; stroke: string; strokeWidth: number; lineJoin: LineJoin;
  lastOn: boolean; lastStyle: "fill" | "outline"; lastFill: string; lastAnchors: boolean; lastHandles: boolean; lastHold: number;
};

/** Targets that change frame geometry (normalisation) versus paint only. */
export const geometryTargets = [FRAMES_TARGET, "frames.fit"] as const;
export const motionTargets = ["motion.sequence", "motion.delay", "motion.duration", "motion.easing", "motion.curve"] as const;
export const overlayTargets = [
  "overlay.anchors", "overlay.handles", "overlay.labels", "overlay.decimals",
  "overlay.labelSize", "overlay.pointSize", "overlay.anchorColor", "overlay.handleColor", "overlay.export", "overlay.exportDots",
] as const;
export const lastFrameTargets = ["lastFrame.hold", "lastFrame.on", "lastFrame.style", "lastFrame.fill", "lastFrame.anchors", "lastFrame.handles"] as const;
export const shapeTargets = ["shape.outline", "shape.fillOn", "shape.fill", "shape.stroke", "shape.strokeWidth", "shape.lineJoin"] as const;

export function readMorphSettings(values: Readonly<Record<string, unknown>>): MorphSettings {
  const v = <T>(target: string, fallback: T) => (values[target] ?? fallback) as T;
  const d = morphDefaults;
  return {
    fit: v("frames.fit", d.fit),
    sequence: v("motion.sequence", d.sequence),
    delay: v("motion.delay", d.delay),
    duration: v("motion.duration", d.duration),
    hold: (100 * v("motion.delay", d.delay)) / Math.max(1, v("motion.delay", d.delay) + v("motion.duration", d.duration)),
    easing: v("motion.easing", d.easing),
    curve: v("motion.curve", d.curve),
    outline: v("shape.outline", d.outline),
    anchors: v("overlay.anchors", d.anchors),
    handles: v("overlay.handles", d.handles),
    labels: v("overlay.labels", d.labels),
    decimals: Number(v("overlay.decimals", d.decimals)),
    labelSize: v("overlay.labelSize", d.labelSize),
    pointSize: v("overlay.pointSize", d.pointSize),
    anchorColor: v("overlay.anchorColor", d.anchorColor),
    handleColor: v("overlay.handleColor", d.handleColor),
    overlayExport: v("overlay.export", d.overlayExport),
    exportDots: v("overlay.exportDots", d.exportDots),
    fillOn: v("shape.fillOn", d.fillOn),
    fill: v("shape.fill", d.fill),
    stroke: v("shape.stroke", d.stroke),
    strokeWidth: v("shape.strokeWidth", d.strokeWidth),
    lineJoin: v("shape.lineJoin", d.lineJoin),
    lastOn: v("lastFrame.on", d.lastOn),
    lastStyle: v("lastFrame.style", d.lastStyle),
    lastFill: v("lastFrame.fill", d.lastFill),
    lastAnchors: v("lastFrame.anchors", d.lastAnchors),
    lastHold: v("lastFrame.hold", d.lastHold),
    lastHandles: v("lastFrame.handles", d.lastHandles),
  };
}
