import { registerToolcraftRendererPipeline, type ToolcraftRendererPipelinePassContract } from "@/toolcraft/runtime";

import { geometryTargets, lastFrameTargets, motionTargets, overlayTargets, shapeTargets } from "./morph-settings";
import type { FrameEntry } from "./morph-frames";
import type { Subpath } from "./morph-types";

const STAGE = {
  kind: "intrinsic",
  reason: "The first frame's SVG viewBox is the document canvas of the source files; artwork outside a viewBox lies outside the SVG document in the original files too.",
} as const;

const canvasTargets = ["canvas.size.width", "canvas.size.height"];
const timelineTargets = ["timeline.currentTimeSeconds", "timeline.durationSeconds"];
const sceneInputs = [...motionTargets, ...shapeTargets, ...lastFrameTargets, ...overlayTargets, ...canvasTargets, ...timelineTargets];

export const morphPipeline = registerToolcraftRendererPipeline<{
  decode: ToolcraftRendererPipelinePassContract<readonly FrameEntry[]>;
  normalize: ToolcraftRendererPipelinePassContract<Subpath[][]>;
  scene: ToolcraftRendererPipelinePassContract<string>;
  export: ToolcraftRendererPipelinePassContract<void>;
}>()({
  runtimeId: "morphium-v1",
  passes: [
    {
      id: "decode", kind: "decode", inputs: [geometryTargets[0]], invalidatedBy: [geometryTargets[0]], cacheKey: ["resources"],
      runsOn: "main", output: "source", quality: "full", sceneBounds: STAGE,
      cost: { dimensions: ["frames", "segments"], relationship: "product", frequency: "discrete" },
      lifecycle: { cache: "memoized", resourceScope: "source" },
    },
    {
      id: "normalize", kind: "preprocess", inputs: [...geometryTargets], invalidatedBy: [...geometryTargets], cacheKey: ["resources", "fit"],
      runsOn: "main", output: "intermediate", quality: "full", sceneBounds: STAGE,
      cost: { dimensions: ["frames", "segments"], relationship: "product", frequency: "discrete" },
      lifecycle: { cache: "memoized", resourceScope: "source" },
    },
    {
      id: "scene", kind: "vector-build", inputs: sceneInputs, invalidatedBy: sceneInputs, cacheKey: ["scene"],
      runsOn: "main", output: "preview", quality: "full", sceneBounds: STAGE,
      cost: { dimensions: ["segments"], relationship: "linear", frequency: "frame" },
      lifecycle: { cache: "memoized", resourceScope: "renderer" },
    },
    {
      id: "export", kind: "export", inputs: [...geometryTargets, ...sceneInputs, "export.image.resolution", "export.video.resolution"],
      invalidatedBy: ["export.image", "export.video"], runsOn: "export-only", output: "export", quality: "export",
      cost: { dimensions: ["segments", "resolution"], relationship: "product", frequency: "batch" },
      lifecycle: { cache: "none", resourceScope: "call" },
    },
  ],
  interactionInvalidation: [
    { interaction: "initial-render", targets: ["canvas"], invalidates: ["decode", "normalize", "scene"] },
    { interaction: "media-import", targets: [geometryTargets[0]], invalidates: ["decode", "normalize", "scene"], mustNotInvalidate: [] },
    { interaction: "control-change", targets: [geometryTargets[1]], invalidates: ["normalize", "scene"], mustNotInvalidate: ["decode"] },
    { interaction: "timeline-playback", targets: ["timeline"], invalidates: ["scene"], mustNotInvalidate: ["decode", "normalize"] },
    { interaction: "timeline-scrub", targets: ["timeline"], invalidates: ["scene"], mustNotInvalidate: ["decode", "normalize"] },
    {
      interaction: "control-drag",
      targets: ["motion.delay", "motion.duration", "overlay.labelSize", "overlay.pointSize", "shape.strokeWidth"],
      invalidates: ["scene"], mustNotInvalidate: ["decode", "normalize"],
    },
    {
      interaction: "control-change",
      targets: [...motionTargets, ...shapeTargets, ...lastFrameTargets, ...overlayTargets, ...canvasTargets],
      invalidates: ["scene"], mustNotInvalidate: ["decode", "normalize"],
    },
    {
      interaction: "control-change",
      targets: ["appearance.background", "export.includeBackground", "canvas.infinity", "canvas.workspaceBackground",
        "export.image.format", "export.image.resolution", "export.video.format", "export.video.resolution"],
      invalidates: [], mustNotInvalidate: ["decode", "normalize", "scene"],
    },
    { interaction: "viewport-drag", targets: ["canvas"], invalidates: [], mustNotInvalidate: ["decode", "normalize", "scene"] },
    { interaction: "viewport-zoom", targets: ["canvas"], invalidates: [], mustNotInvalidate: ["decode", "normalize", "scene"] },
    { interaction: "export", targets: ["export.image", "export.video"], invalidates: ["export"], mustNotInvalidate: ["decode", "normalize", "scene"] },
  ],
});

export const decodePass = morphPipeline.getPass("decode");
export const normalizePass = morphPipeline.getPass("normalize");
export const scenePass = morphPipeline.getPass("scene");
export const exportPass = morphPipeline.getPass("export");
