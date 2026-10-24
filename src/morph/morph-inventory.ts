import type { ToolcraftControlSectionInventoryEntry, ToolcraftProductReadiness } from "../app/acceptance/types";

import { lastFrameTargets, motionTargets, overlayTargets, shapeTargets } from "./morph-settings";

/** The user's first message in this session, kept verbatim as export-request evidence. */
export const ORIGINAL_REQUEST_TEXT =
  "I need a html tool to animate between the SVG states. I need a way to control speed of animation, outline view, to turn berziers and anchors on and off. to show their mathematical location in numbers floating over the anchors. To control background colour, shape colour and stroke thickness. Add ability to control animation easing. Add a way to upload up to 5 frames. Add ability to export video  and images";
const ORIGINAL_REQUEST_REF =
  "C:/Users/pc/.claude/projects/C--Users-pc-Desktop-Claudio/308f3290-5474-4992-b7bb-e20b8685e750.jsonl#line=3;uuid=85f0e598-218d-43ab-975e-4669b1ba48de";

export const morphSectionInventory = [
  {
    id: "runtime.setup", title: "Settings", entityId: "background", entity: "Output background",
    targets: ["export.includeBackground", "appearance.background"],
    groupingReason: "One output background; runtime relocates this source pair into Settings.",
    finiteSelectors: [{ target: "export.includeBackground", role: "parameter", reason: "Controls background visibility and PNG alpha; the colour stays editable in both states." }],
  },
  {
    id: "frames", title: "Frames", entityId: "frames", entity: "SVG frames", workflowStage: "upload",
    splitReason: "Uploading, removing and ordering files is its own task with its own reset: Reset restores the demo frames.",
    targets: ["frames.source"], groupingReason: "The uploaded files are the source keyframes in animation order.", finiteSelectors: [],
  },
  {
    id: "frame-fitting", title: "Fitting", entityId: "frames", entity: "SVG frames", workflowStage: "fitting",
    splitReason: "How frames are aligned to each other is set after upload and resets independently of the file list.",
    targets: ["frames.fit"], groupingReason: "Alignment of the uploaded frames into the first frame's coordinates.",
    finiteSelectors: [{ target: "frames.fit", role: "parameter", reason: "Changes how each frame is scaled into frame 1; no other control depends on it." }],
  },
  {
    id: "motion", title: "Motion", entityId: "motion", entity: "Morph timing", targets: [...motionTargets],
    groupingReason: "Order, rest time and easing of the morph between keyframes; the timeline owns duration and transport.",
    finiteSelectors: [
      { target: "motion.sequence", role: "parameter", reason: "Changes keyframe order within the loop without gating other controls." },
      { target: "motion.easing", role: "branch", affectedTargets: [], reason: "Custom curve reveals the curve editor; presets hide it." },
    ],
  },
  {
    id: "shape", title: "Shape", entityId: "shape", entity: "Morphing shape", targets: [...shapeTargets],
    groupingReason: "How the path is painted: outline mode or fill and stroke styling.",
    finiteSelectors: [
      { target: "shape.outline", role: "branch", affectedTargets: [], reason: "Outline view ignores fill and stroke, so their controls are absent while it is on." },
      { target: "shape.fillOn", role: "branch", affectedTargets: [], reason: "Fill colour applies only while Fill is on." },
      { target: "shape.lineJoin", role: "parameter", reason: "Changes stroke corners only." },
    ],
  },
  {
    id: "last-frame", title: "Last Frame", entityId: "last-frame", entity: "Last frame style", targets: [...lastFrameTargets],
    groupingReason: "An optional look for the final frame that crossfades with the shared shape style.",
    finiteSelectors: [
      { target: "lastFrame.on", role: "branch", affectedTargets: [], reason: "Look and colour apply only while the last frame has its own style." },
      { target: "lastFrame.style", role: "branch", affectedTargets: [], reason: "The colour applies only to the Fill look." },
      { target: "lastFrame.anchors", role: "parameter", reason: "Hides anchor points on the last frame only." },
      { target: "lastFrame.handles", role: "parameter", reason: "Hides handle lines and points on the last frame only." },
    ],
  },
  {
    id: "display", title: "Display", entityId: "display", entity: "Point overlays", targets: [...overlayTargets],
    groupingReason: "Anchors, handles and coordinate labels drawn over the shape, and whether they appear in exports. Ten controls stay together because they share one reset and one overlay layer.",
    finiteSelectors: [
      { target: "overlay.anchors", role: "branch", affectedTargets: [], reason: "Anchor colour applies only while anchors are shown." },
      { target: "overlay.handles", role: "branch", affectedTargets: [], reason: "Handle colour applies only while handles are shown." },
      { target: "overlay.labels", role: "branch", affectedTargets: [], reason: "Decimals and label size apply only while coordinates are shown." },
      { target: "overlay.decimals", role: "parameter", reason: "Changes label precision only." },
      { target: "overlay.export", role: "parameter", reason: "Adds overlays to exported files; preview is unchanged." },
    ],
  },
  {
    id: "runtime.image-export", title: "Image Export", entityId: "image-export", entity: "Raster image output",
    targets: ["export.image.format", "export.image.resolution"], groupingReason: "Runtime-owned image format and resolution govern one exported artifact.",
    finiteSelectors: [
      { target: "export.image.format", role: "parameter", reason: "Selects PNG alpha support or opaque JPEG encoding." },
      { target: "export.image.resolution", role: "parameter", reason: "Selects the output long-edge pixel size." },
    ],
  },
  {
    id: "runtime.video-export", title: "Video Export", entityId: "video-export", entity: "Video output",
    targets: ["export.video.format", "export.video.resolution"], groupingReason: "Runtime-owned container and size for one exported video.",
    finiteSelectors: [
      { target: "export.video.format", role: "parameter", reason: "Selects MP4 or WebM container." },
      { target: "export.video.resolution", role: "parameter", reason: "Selects canvas size or 4K output." },
    ],
  },
] as const satisfies readonly ToolcraftControlSectionInventoryEntry[];

const panelProperty = (target: string, detail: string) => ({
  id: `${target}-property`, target, capability: "property-edit" as const, surface: "panel" as const,
  selectionScope: { mode: "global" as const },
  evidence: { source: "reference" as const, detail },
  reason: "A global setting of the whole morph with no selected entity.",
  alternative: { surface: "canvas" as const, reason: "Persistent value controls would cover the artwork being inspected." },
});

export const morphReadiness: ToolcraftProductReadiness = {
  mode: "product",
  productName: "Morphium",
  productSummary: "Animates between up to five uploaded SVG frames with bézier anchor, handle and coordinate overlays.",
  requestedBehavior: ORIGINAL_REQUEST_TEXT,
  exportIntent: {
    image: { mode: "toolcraft-default" },
    svg: { mode: "not-requested" },
    video: {
      mode: "user-requested",
      evidence: { source: "user-message", messageRef: ORIGINAL_REQUEST_REF, messageText: ORIGINAL_REQUEST_TEXT, quote: "Add ability to export video  and images" },
    },
  },
  viewInteraction: { mode: "non-spatial", reason: "The output is a flat two-dimensional vector shape with no three-dimensional scene or camera." },
  interactionOwnership: [
    {
      id: "frames.source-collection", target: "frames.source", capability: "collection-edit", surface: "panel",
      evidence: { source: "reference", detail: "The original page managed frames in a thumbnail strip outside the stage." },
      reason: "Uploading, removing and ordering files is list management, not spatial editing.",
      alternative: { surface: "canvas", reason: "File list chrome on the canvas would cover the artwork." },
    },
    panelProperty("frames.fit", "The original sidebar had a viewBox/Content segmented control."),
    ...motionTargets.map((t) => panelProperty(t, "The original sidebar held sequence, hold and easing controls.")),
    ...shapeTargets.map((t) => panelProperty(t, "The original sidebar held outline, fill and stroke controls.")),
    ...lastFrameTargets.map((t) => panelProperty(t, "Requested by the user: outline on every frame, solid fill on the last one.")),
    ...overlayTargets.map((t) => panelProperty(t, "The original sidebar held anchor, handle and label controls.")),
  ],
};
