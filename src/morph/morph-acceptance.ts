import type { ToolcraftComponentAcceptance, ToolcraftReferenceCoverage } from "../app/acceptance/types";
import { appSchema } from "../app/app-schema";

import { displayControls, fittingControls, lastFrameControls, motionControls, shapeControls } from "./morph-controls";

type Budget = "standard" | "extended-io";
type Row = ToolcraftComponentAcceptance;

const browser = (file: string, testName: string, budget: Budget = "standard") =>
  ({ file: `e2e/${file}.spec.ts` as `e2e/${string}.spec.ts`, testName, budget });

/** Rows whose behaviour is inventoried from the original page. */
const referenceCoverage: Record<string, ToolcraftReferenceCoverage> = {
  "frames.fit": "renderer-state",
  "motion.sequence": "control-mapping",
  "motion.delay": "control-mapping",
  "motion.easing": "control-mapping",
  "motion.curve": "control-mapping",
  "shape.outline": "control-mapping",
  "shape.fill": "control-mapping",
  "shape.strokeWidth": "control-mapping",
  "overlay.anchors": "control-mapping",
  "overlay.handles": "control-mapping",
  "overlay.labels": "control-mapping",
  "appearance.background": "control-mapping",
};

const optionsOf = (control: { options?: readonly { value: string }[] }) => control.options?.map((o) => o.value);

const productControls = [fittingControls, motionControls, shapeControls, lastFrameControls, displayControls].flatMap((section) => Object.values(section));

const controlRows: Row[] = productControls.map((control) => {
  const options = "options" in control ? optionsOf(control) : undefined;
  const target = control.target;
  return {
    id: target, target, kind: "control", componentType: control.type, interactionId: control.type === "actions" ? `${target}-command` : `${target}-property`,
    automated: true, automatedTestName: `morph parameter ${target}`,
    browser: browser("product-morph-controls", `browser: morph parameter ${target}`),
    evidence: target === "overlay.export" || target === "overlay.exportDots" ? "exported-bytes" : "product-output",
    fixture: "Default demo frames, playback paused on a mid-morph time so overlays and shape are both visible.",
    userAction: `Change ${control.label} through the real control.`,
    expectedObservable: "The rendered morph preview changes according to the setting.",
    ...(options ? { optionCoverage: options } : {}),
    ...(control.type === "curves" ? { controlPartCoverage: ["curves.points"] as const } : {}),
    ...(referenceCoverage[target] ? { referenceCoverage: referenceCoverage[target] } : {}),
  } satisfies Row;
});

const exportSettingRow = (target: string, options: readonly string[], kind: "image" | "video"): Row => ({
  id: target, target, kind: "control", componentType: "select",
  automated: true, automatedTestName: `morph contract ${target}`,
  browser: kind === "image"
    ? browser("product-morph-export", "browser: morph image export delivers all formats and sizes", "extended-io")
    : browser("product-morph-video", "browser: morph video export delivers formats and sizes", "extended-io"),
  evidence: "exported-bytes", optionCoverage: options,
  fixture: "Default demo frames.", userAction: `Select each ${target} option and export.`,
  expectedObservable: "The downloaded file has the selected format and dimensions.",
});

const runtimeRow = (id: string, target: string, evidence: Row["evidence"], file: string, testName: string, extra: Partial<Row>, budget: Budget = "standard"): Row => ({
  id, target, kind: "runtime", componentType: id, automated: true, automatedTestName: `morph contract ${id}`,
  browser: browser(file, testName, budget), evidence,
  fixture: "Default demo frames and real Toolcraft controls.",
  userAction: `Exercise ${id} through the visible UI.`,
  expectedObservable: `The morph output and runtime workspace implement ${id}.`,
  ...extra,
});

export const morphAcceptance: readonly Row[] = [
  {
    id: "frames.source", target: "frames.source", kind: "control", componentType: "fileDrop", interactionId: "frames.source-collection",
    automated: true, automatedTestName: "morph contract frames.source",
    browser: browser("product-morph-frames", "browser: morph frames upload, remove, reorder and reset", "extended-io"),
    evidence: "media-lifecycle",
    mediaLifecycleCoverage: ["upload", "remove", "reset", "default-remove", "default-reset", "reorder", "order-output"],
    fixture: "Demo frames plus an uploaded square SVG.", referenceCoverage: "media-lifecycle",
    userAction: "Upload an SVG, remove frames, drag to reorder and use section Reset.",
    expectedObservable: "The frame list and the morph sequence follow every upload, removal, reorder and reset.",
  },
  ...controlRows,
  {
    ...controlRows[0], id: "appearance.background", target: "appearance.background", componentType: "color", interactionId: undefined,
    automatedTestName: "morph contract appearance.background",
    browser: browser("product-morph-background", "browser: morph background color changes output"),
    userAction: "Change Background color.", referenceCoverage: "control-mapping", optionCoverage: undefined,
  },
  runtimeRow("background.output", "export.includeBackground", "product-output", "product-morph-background",
    "browser: morph background output follows runtime semantics",
    { kind: "control", componentType: "switch", backgroundOutputCoverage: "all-required-background-output" }),
  exportSettingRow("export.image.format", ["png", "jpg"], "image"),
  exportSettingRow("export.image.resolution", ["2k", "4k", "8k"], "image"),
  exportSettingRow("export.video.format", ["mp4", "webm"], "video"),
  exportSettingRow("export.video.resolution", ["current", "4k"], "video"),
  runtimeRow("export.image", "actions.output", "exported-bytes", "product-morph-export",
    "browser: morph image export delivers all formats and sizes",
    { componentType: "panelActions", actionCoverage: ["export.png"], exportArtifactCoverage: "all-required-image-export-behavior", infinityCanvasCoverage: "scene-bounds-image-export", referenceCoverage: "export-copy" }, "extended-io"),
  runtimeRow("export.actions", "actions.output", "exported-bytes", "product-morph-export",
    "browser: morph footer exports PNG and video",
    { kind: "control", componentType: "panelActions", actionCoverage: ["export.png", "export.video"], exportArtifactCoverage: ["all-required-image-export-behavior", "all-required-video-export-behavior"] }, "extended-io"),
  runtimeRow("export.video", "actions.output", "exported-bytes", "product-morph-video",
    "browser: morph video export delivers formats and sizes",
    { componentType: "panelActions", actionCoverage: ["export.video"], exportArtifactCoverage: "all-required-video-export-behavior", infinityCanvasCoverage: "scene-bounds-video-export", referenceCoverage: "export-copy" }, "extended-io"),
  runtimeRow("timeline.playback", "timeline", "timeline-output", "product-morph-timeline",
    "browser: morph timeline plays, scrubs, changes duration and loops",
    {
      timelineCoverage: "playback", timelinePlaybackCoverage: "all-playback-behavior",
      timelineLoopProof: { direction: "forward-only", reversePlayback: "forbidden", seam: "first-last-match", durationChange: "reproved-after-edit" },
      referenceCoverage: "time-progress", referenceTimelineCoverage: "playback",
    }),
  runtimeRow("canvas.size", "canvas.size.width", "product-output", "product-morph-workspace",
    "browser: morph canvas sizing changes output", { referenceCoverage: "canvas-sizing" }),
  runtimeRow("canvas.infinity", "canvas.infinity", "viewport-side-effect", "product-morph-workspace",
    "browser: morph infinity preserves scene and viewport", { infinityCanvasCoverage: "mode-continuity-and-restoration", referenceCoverage: "canvas-sizing" }),
  runtimeRow("persistence.reload", "canvas.size.width", "persistence-state", "product-morph-persistence",
    "browser: morph restores frames and workspace after reload",
    { referenceCoverage: "renderer-state", persistenceCoverage: "reload", persistenceSlices: appSchema.persistence.storage === "localStorage" ? appSchema.persistence.include : [] }, "extended-io"),
];
