import type { ToolcraftControlSchema } from "@/toolcraft/runtime";

import { EASING_PRESETS } from "./morph-easing";
import { FRAMES_TARGET, MAX_FRAMES, morphDefaults as d } from "./morph-settings";

const always = { applicability: { mode: "always" } } as const;
const live = {
  ...always, keyframeable: false, performanceRole: "responsiveness",
  performanceReason: "Rebuilds the current interpolated frame without decoding or re-normalising the SVG frames.",
} as const;
const when = (target: string, condition: Record<string, unknown>) =>
  ({ applicability: { mode: "conditional", all: [{ target, ...condition }] } }) as const;

export const backgroundControls = {
  include: { ...live, type: "switch", target: "export.includeBackground", label: "Background", defaultValue: true },
  color: { ...live, type: "color", target: "appearance.background", label: "Background color", defaultValue: d.background },
} as const satisfies Record<string, ToolcraftControlSchema>;

export const frameControls = {
  files: {
    ...always, type: "fileDrop", target: FRAMES_TARGET, label: "SVG files", assetKind: "file",
    accept: ".svg,image/svg+xml", multiple: true, hardMaxItems: MAX_FRAMES, defaultValue: [],
    description: "Up to five SVG frames. The list order is the animation order; drag files to reorder.",
    performanceRole: "workload",
    performanceReason: "Frame count and segment count set decode, normalisation and per-frame interpolation work.",
  },
} as const satisfies Record<string, ToolcraftControlSchema>;

export const fittingControls = {
  fit: {
    ...live, type: "segmented", target: "frames.fit", label: "Align by", defaultValue: d.fit,
    description: "viewBox keeps each file's own canvas; Content scales every frame's artwork to the first frame's artwork.",
    performanceReason: "Re-normalises the decoded frames once; playback then reuses the result.",
    options: [{ label: "viewBox", value: "viewbox" }, { label: "Content", value: "content" }],
  },
} as const satisfies Record<string, ToolcraftControlSchema>;

export const motionControls = {
  sequence: {
    ...live, type: "segmented", target: "motion.sequence", label: "Sequence", defaultValue: d.sequence,
    description: "Loop goes 1 → last → 1. Ping-pong goes 1 → last → back to 1. Both start and end on frame 1.",
    options: [{ label: "Loop", value: "loop" }, { label: "Ping-pong", value: "pingpong" }],
  },
  delay: {
    ...live, type: "slider", target: "motion.delay", label: "Delay", defaultValue: d.delay,
    min: 0, max: 3000, step: 50, unit: "ms", sliderValueKind: "continuous",
    description: "How long each frame rests before morphing to the next.",
  },
  duration: {
    ...live, type: "slider", target: "motion.duration", label: "Duration", defaultValue: d.duration,
    min: 100, max: 6000, step: 50, unit: "ms", sliderValueKind: "continuous",
    description: "How long each morph takes. The timeline length follows: steps × (delay + duration).",
  },
  easing: {
    ...live, type: "select", target: "motion.easing", label: "Easing", defaultValue: d.easing,
    options: [
      ...Object.entries(EASING_PRESETS).map(([value, preset]) => ({ label: preset.label, value })),
      { label: "Custom curve", value: "custom" },
    ],
  },
  curve: {
    ...live, ...when("motion.easing", { equals: "custom" }), type: "curves", target: "motion.curve", label: "Curve",
    variant: "single", curveIntent: "single-value-map", interpolation: "smooth", defaultValue: d.curve,
    description: "Progress of each morph over time. Output is clamped to 0–1.",
  },
} as const satisfies Record<string, ToolcraftControlSchema>;

const styled = when("shape.outline", { equals: false });

export const shapeControls = {
  outline: {
    ...live, type: "switch", target: "shape.outline", label: "Outline view", defaultValue: d.outline,
    description: "Draws the path as a thin line with no fill or stroke styling.",
  },
  fillOn: { ...live, ...styled, type: "switch", target: "shape.fillOn", label: "Fill", defaultValue: d.fillOn },
  fill: {
    ...live,
    applicability: { mode: "conditional", all: [{ target: "shape.outline", equals: false }, { target: "shape.fillOn", equals: true }] },
    type: "color", target: "shape.fill", label: "Fill color", semanticGroup: "fill", defaultValue: d.fill,
  },
  stroke: {
    ...live, ...styled, type: "color", target: "shape.stroke", label: "Stroke color", semanticGroup: "stroke", defaultValue: d.stroke,
    description: "Visible once Stroke width is above zero.",
  },
  strokeWidth: {
    ...live, ...styled, type: "slider", target: "shape.strokeWidth", label: "Stroke width", defaultValue: d.strokeWidth,
    min: 0, max: 40, step: 0.5, sliderValueKind: "continuous", editableRange: { hardMin: 0 },
    description: "In the first frame's SVG units. Zero removes the stroke.",
  },
  lineJoin: {
    ...live, ...styled, type: "segmented", target: "shape.lineJoin", label: "Line join", defaultValue: d.lineJoin,
    description: "Corner style of the stroke.",
    options: [{ label: "Miter", value: "miter" }, { label: "Round", value: "round" }, { label: "Bevel", value: "bevel" }],
  },
} as const satisfies Record<string, ToolcraftControlSchema>;

export const displayControls = {
  anchors: { ...live, type: "switch", target: "overlay.anchors", label: "Anchors", defaultValue: d.anchors },
  anchorColor: {
    ...live, ...when("overlay.anchors", { equals: true }), type: "color", target: "overlay.anchorColor",
    label: "Anchor color", semanticGroup: "anchor", defaultValue: d.anchorColor,
  },
  handles: { ...live, type: "switch", target: "overlay.handles", label: "Bézier handles", defaultValue: d.handles },
  handleColor: {
    ...live, ...when("overlay.handles", { equals: true }), type: "color", target: "overlay.handleColor",
    label: "Handle color", semanticGroup: "handle", defaultValue: d.handleColor,
  },
  pointSize: {
    ...live, type: "slider", target: "overlay.pointSize", label: "Point size", defaultValue: d.pointSize,
    min: 2, max: 10, step: 0.5, unit: "px", sliderValueKind: "continuous",
  },
  labels: {
    ...live, type: "segmented", target: "overlay.labels", label: "Coordinates", defaultValue: d.labels,
    description: "Shows x, y in the first frame's SVG coordinates next to each point.",
    options: [{ label: "Off", value: "off" }, { label: "Anchors", value: "anchors" }, { label: "Handles", value: "handles" }, { label: "Both", value: "both" }],
  },
  decimals: {
    ...live, ...when("overlay.labels", { notEquals: "off" }), type: "segmented", target: "overlay.decimals",
    label: "Decimals", defaultValue: d.decimals,
    options: [{ label: "0", value: "0" }, { label: "1", value: "1" }, { label: "2", value: "2" }],
  },
  labelSize: {
    ...live, ...when("overlay.labels", { notEquals: "off" }), type: "slider", target: "overlay.labelSize",
    label: "Label size", defaultValue: d.labelSize, min: 8, max: 18, step: 1, unit: "px", sliderValueKind: "continuous",
  },
  includeInExport: {
    ...live, type: "switch", target: "overlay.export", label: "Show in export", defaultValue: d.overlayExport,
    description: "Includes anchors, handles and coordinates in PNG, JPG and video exports.",
  },
} as const satisfies Record<string, ToolcraftControlSchema>;
