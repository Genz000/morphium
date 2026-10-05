import type { ToolcraftEnvelopePerformanceConfig, ToolcraftPerformanceFixtureAdapter } from "@/toolcraft/runtime";

import { MAX_SEGMENTS_PER_FRAME } from "./morph-frames";
import { morphPipeline } from "./morph-pipeline";
import { MAX_FRAMES } from "./morph-settings";

const numeric = (dimensionId: string): ToolcraftPerformanceFixtureAdapter => ({ dimensionId, apply: (value) => value, observe: (value) => Number(value) });
const resolutionValues: Record<string, number> = { "2k": 2048, "4k": 4096, "8k": 8192 };

export const morphPerformanceModel = {
  usesCustomRenderer: true,
  rendererStrategy: "svg",
  rendererPipeline: morphPipeline,
  scenarios: [],
  rendererTechnique: {
    sourceRepresentation: "svg",
    productRepresentation: "vector",
    previewRenderer: "svg",
    exportRenderer: "canvas-2d",
    rendererStrategy: "svg",
    previewExportDifferenceReason:
      "Preview is SVG so paths, anchors and labels stay sharp at any canvas zoom without re-rasterising; runtime image/video export needs pixels, so the same path data and overlay geometry are drawn with Canvas 2D at the export frame.",
    whyNotAlternativeStrategies: [
      "Canvas 2D preview would need backing-resolution management and re-rasterising on every zoom for crisp overlays.",
      "WebGL adds no benefit for a few thousand bézier segments and complicates text labels.",
    ],
    fidelityRisks: [
      "SVG preview and Canvas 2D export must use identical path data, fill rule (evenodd) and overlay sizes.",
      "Label background widths are estimated from monospace character width in the preview.",
    ],
    performanceRisks: [
      "Every playback frame rebuilds the interpolated path and overlay DOM; cost grows with segment count and labels.",
      "Decoding and normalisation run once per frame set and are memoised; they must not run during playback.",
    ],
    layers: [
      { id: "shape", kind: "product-foreground", content: ["geometry"], renderer: "svg", primitiveCount: "medium", exportMode: "included", uiSelector: '[data-testid="morph-shape"]' },
      { id: "overlays", kind: "product-foreground", content: ["geometry", "text"], renderer: "svg", primitiveCount: "high", exportMode: "included", uiSelector: '[data-testid="morph-overlays"]' },
    ],
  },
  workloadEnvelope: {
    dimensions: [
      { id: "frames", unit: "frames", source: { kind: "external-input", id: "uploaded-svg-frames" }, mapping: "direct", defaultValue: 4, interactiveMax: MAX_FRAMES, batchMax: MAX_FRAMES },
      { id: "segments", unit: "segments per frame", source: { kind: "external-input", id: "svg-segment-count" }, mapping: "direct", defaultValue: 10, interactiveMax: MAX_SEGMENTS_PER_FRAME, batchMax: MAX_SEGMENTS_PER_FRAME },
      { id: "resolution", unit: "long-edge pixels", source: { kind: "schema-target", target: "export.image.resolution" }, mapping: "area", defaultValue: 4096, batchMax: 8192 },
    ],
  },
  fixtureAdapters: {
    dimensions: {
      frames: numeric("frames"),
      segments: numeric("segments"),
      resolution: {
        dimensionId: "resolution", kind: "exhaustive-discrete",
        domain: { kind: "schema-options", target: "export.image.resolution", optionValues: ["2k", "4k", "8k"] },
        entries: Object.entries(resolutionValues).map(([appliedValue, value]) => ({ appliedValue, value })),
        apply: (value) => Object.keys(resolutionValues).find((key) => resolutionValues[key] === value)!,
        observe: (value) => resolutionValues[String(value)]!,
      },
    },
  },
} as const satisfies ToolcraftEnvelopePerformanceConfig;
