import type { ToolcraftTransferMode } from "../app/acceptance/types";

/**
 * Loop length of the original page with its demo: four transitions of
 * 1.2 s plus a 0.5 s hold each (Loop mode returns to frame 1).
 */
export const REFERENCE_LOOP_SECONDS = 6.8;

const SOURCE = "C:/Users/pc/Desktop/Claudio/morphium/index.html";
const RUN = "Original served with `npx serve morphium -l 5380` and opened at http://localhost:5380 in the Claude desktop built-in browser on 2026-10-05";
const APPROVAL =
  'Approved by the user on 2026-10-05 in this session: answered "Yes, approve all" to the listed Toolcraft replacements';

type Feature = readonly [id: string, name: string, acceptanceId: string, behavior: string, mapping: string, status: "ported" | "toolcraft-native" | "intentionally-changed", approval?: string];

const features: readonly Feature[] = [
  ["parse", "SVG parsing to cubic paths", "frames.source", "path, rect, circle, ellipse, line, polyline, polygon and <use> are converted to absolute cubic subpaths with transforms and arcs applied.", "Same parser ported to src/morph/morph-path.ts and morph-svg.ts.", "ported"],
  ["upload", "Upload up to five frames", "frames.source", "File picker and window drop accept SVG files; a sixth file is refused with a message.", "fileDrop (file kind, accept .svg, hardMaxItems 5) owns upload, canvas drop routing, admission and removal.", "toolcraft-native"],
  ["reorder", "Frame order", "frames.source", "Thumbnails drag to reorder; order is the animation order.", "fileDrop list order is runtime media order and drives keyframe order.", "toolcraft-native"],
  ["demo", "Demo frames", "frames.source", "Four demo frames (circle, star, blob, rounded square with hole) load on start and from a Load demo button.", "Default media assets; Reset restores them.", "intentionally-changed", `${APPROVAL} ("demo button → Toolcraft Reset").`],
  ["fit", "Frame fitting", "frames.fit", "viewBox mode keeps each file's canvas; Content mode scales artwork to the first frame's artwork.", "frames.fit segmented control, same fitFrames math.", "ported"],
  ["morph", "Morph normalisation", "frames.fit", "Subpaths matched by position and size, ghosts grow from points, segments subdivided by length, closed-path starts aligned.", "normalizeFrames ported unchanged; memoised normalize pass.", "ported"],
  ["sequence", "Loop and Ping-pong", "motion.sequence", "Loop 1→…→n→1; Ping-pong 1→…→n→…→1.", "motion.sequence segmented control inside one forward timeline loop.", "ported"],
  ["once", "Once playback", "timeline.playback", "Once plays 1→…→n and stops on the last frame.", "Timeline loop switch stops at the end instead.", "intentionally-changed", `${APPROVAL} ("'Once' playback → the timeline's own loop switch").`],
  ["hold", "Hold and transition time", "motion.delay", "Hold (0.5 s) and transition (1.2 s) sliders per step.", "motion.delay and motion.duration sliders in milliseconds; timeline length follows.", "ported"],
  ["speed", "Transition time and speed", "timeline.playback", "Transition slider (0.1–6 s) and speed multiplier set how fast morphs run.", "Toolcraft timeline duration sets loop length.", "intentionally-changed", `${APPROVAL} ("Transition + Speed sliders → the timeline's duration").`],
  ["easing", "Easing presets", "motion.easing", "Twenty presets including back, elastic, bounce and steps.", "motion.easing select with the same twenty curves.", "ported"],
  ["custom-easing", "Custom easing curve", "motion.curve", "Draggable cubic-bézier editor with four numeric fields.", "Toolcraft curves control (single, smooth) when Easing is Custom curve.", "intentionally-changed", `${APPROVAL} ("Custom bézier editor → Toolcraft's curve editor").`],
  ["outline", "Outline view", "shape.outline", "Draws the path as a 1 px line with no fill or stroke.", "shape.outline switch; fill and stroke controls hide while it is on.", "ported"],
  ["fill", "Shape colour", "shape.fill", "Fill colour with on/off switch.", "shape.fillOn switch and shape.fill colour.", "ported"],
  ["stroke", "Stroke", "shape.strokeWidth", "Stroke colour, width (0–40 SVG units) and line join.", "shape.stroke, shape.strokeWidth, shape.lineJoin.", "ported"],
  ["anchors", "Anchors on/off", "overlay.anchors", "Square anchor markers with a colour picker.", "overlay.anchors switch and overlay.anchorColor.", "ported"],
  ["handles", "Bézier handles on/off", "overlay.handles", "Handle lines and control points, hidden on straight segments.", "overlay.handles switch and overlay.handleColor.", "ported"],
  ["labels", "Coordinate labels", "overlay.labels", "x, y labels over anchors and/or handles in frame-1 coordinates with 0–2 decimals and adjustable size.", "overlay.labels, overlay.decimals, overlay.labelSize, overlay.pointSize.", "ported"],
  ["background", "Background colour", "appearance.background", "Stage background colour picker.", "Runtime Background switch and colour.", "toolcraft-native"],
  ["viewport", "Zoom and pan", "canvas.infinity", "Wheel zoom, drag pan, double-click reset.", "Runtime canvas zoom, pan and radar.", "intentionally-changed", `${APPROVAL} ("My zoom/pan ... → Toolcraft's canvas").`],
  ["image-export", "PNG export", "export.image", "PNG of the current frame at 720–3840 px long edge, optional transparency and overlays.", "Runtime Image Export (PNG/JPG, 2K/4K/8K); overlays via Show in export.", "intentionally-changed", `${APPROVAL} ("Export size 720–3840 px ... → Toolcraft's 2K/4K/8K images").`],
  ["svg-export", "SVG export", "export.image", "SVG of the current frame.", "Removed; image export is PNG/JPG only.", "intentionally-changed", 'The user chose "Drop it" for SVG frame export on 2026-10-05 in this session.'],
  ["png-sequence", "PNG sequence", "export.image", "Zip of PNG frames for one or more cycles.", "Removed: Toolcraft does not allow product-made downloads.", "intentionally-changed", `${APPROVAL} ("PNG-sequence .zip → dropped").`],
  ["video-export", "Video export", "export.video", "MP4/WebM rendered frame by frame at 24/30/60 fps for N cycles.", "Runtime Video Export (MP4/WebM, fixed 30 fps, timeline duration).", "intentionally-changed", `${APPROVAL} ("... 24/60 fps → ... fixed 30 fps video").`],
  ["canvas", "Stage size", "canvas.size", "Stage is the first frame's viewBox.", "Frame-1 viewBox is fitted inside the editable Toolcraft artboard.", "toolcraft-native"],
  ["timeline", "Play, pause and scrub", "timeline.playback", "Play/pause button, keyframe steps, scrubbable timeline.", "Toolcraft playback timeline.", "toolcraft-native"],
  ["persistence", "Saved workspace", "persistence.reload", "The original kept no state across reloads.", "Runtime persistence restores values, media, canvas, panels and timeline.", "toolcraft-native"],
];

export const morphTransferMode: ToolcraftTransferMode = {
  mode: "reference-runtime-clone",
  sourceOfTruth: "reference-runtime",
  referenceName: "Morphium (single-file HTML tool)",
  animationIntent: {
    mode: "timeline-playback",
    loopDuration: { seconds: REFERENCE_LOOP_SECONDS, source: "reference", evidence: "Original demo: 4 transitions × (1.2 s transition + 0.5 s hold) = 6.8 s per loop." },
  },
  referenceInputs: [],
  referenceTimeline: {
    mode: "toolcraft-playback",
    behaviorCoverage: ["playback"],
    loopDuration: { seconds: REFERENCE_LOOP_SECONDS, source: "reference", evidence: "Original demo loop measured 6.80 s on its timeline readout." },
  },
  behaviorCoverage: ["canvas-sizing", "control-mapping", "renderer-state", "media-lifecycle", "export-copy", "time-progress"],
  referenceStudy: {
    status: "ran-original",
    referenceLocation: SOURCE,
    sourceEvidence: "index.html read in full: parser (parsePathData, arcToCubics, pathToSubpaths, parseSVG), normalize, lerpShape, EASINGS, stateAt timeline, renderScene/drawOverlays, export handlers.",
    reproductionSteps: RUN,
    behaviorEvidence: "Checked mid-transition circle→star and blob→ring with anchor labels and handles, outline mode, and every export: MP4 6.8 s 720×720, WebM, PNG, SVG and a 204-frame PNG zip.",
  },
  referenceFeatureInventory: features.map(([id, featureName, acceptanceId, referenceBehavior, toolcraftMapping, status, approval]) => ({
    id, featureName, acceptanceId, referenceBehavior, toolcraftMapping, status,
    sourceEvidence: `${SOURCE} (${id})`,
    behaviorEvidence: `${RUN}: ${referenceBehavior}`,
    ...(approval ? { userApprovedChangeReason: approval } : {}),
  })),
};
