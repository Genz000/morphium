# Toolcraft App Agent Worklog

## Status

Mode: product

Active change: morphium-port-1

## Decision Trail

### Change ID: morphium-port-1

- Entry type: first-delivery
- Request: "i want to install this tool in link , and tell me briefly how i can use it , i mean the how not the what https://pixelpoint.io/blog/how-to-craft-personal-design-tools-with-toolcraft/" — port the Morphium single-file SVG morphing tool (built earlier in the same session from the user's request "I need a html tool to animate between the SVG states...") into a Toolcraft app.
- Task type: generated app porting (reference-runtime-clone) covering schema/controls, custom renderer, timeline, media upload and export routes.
- User-visible result: Morphium runs inside the Toolcraft shell: SVG frames upload through the Frames list, the shape morphs on the playback timeline, Motion/Shape/Display sections replace the old sidebar, and PNG/JPG plus MP4/WebM export through the runtime footer.
- Source/reference checked: C:/Users/pc/Desktop/Claudio/morphium/index.html read in full and run at http://localhost:5380 (Claude desktop built-in browser) before porting.
- Reference inputs: None (no video, GIF, Figma or screen recording; the reference is a runnable HTML page recorded in appTransferMode.referenceStudy).
- Docs/contracts read: AGENTS.md; workflow.md; core/runtime-boundary.md; assembly-workflow.md; core/reference-study.md; core/control-selection.md; core/layout.md; core/performance.md; core/timeline-animation.md; core/setup-export.md; core/media-upload.md; core/development-files.md; core/app-cover.md; core/slider-ranges.md; decision-contract.md; schema-reference.md; component-rules.md; renderer-technique.md; performance.md; acceptance-testing.md.
- Contract rules applied: runtime-shell-required, canvas-no-app-ui, infinity-canvas-scene-bounds, interaction-surface-ownership, timeline-mode-choice, output-export-required, controls-section-inventory-required, renderer-technique-inventory, reference-clone-source-of-truth, persistence-policy-explicit.
- View interaction intent: non-spatial — the product is a flat 2D vector shape with no camera or 3D scene; no orientation gizmo.
- Interaction ownership: every product setting is a global panel property-edit (selectionScope global); the frame list is a panel collection-edit. No canvas handles: anchors and handles are read-only visual overlays, not editing handles.
- Decision: SVG preview in scene.canvasContent sized by useToolcraftProductSceneFrame; Canvas 2D drawing for the shared rasterFrameRenderer; morph engine (parser, normaliser, easing, sequence) ported verbatim into src/morph; fileDrop (file kind, .svg, hardMaxItems 5) with the four demo frames as media.defaultAssets; playback timeline with defaultDurationSeconds 6.8 from the reference loop; image and video export modules.
- Alternatives rejected: Canvas 2D preview (needs render-scale backing proof and re-rasterising on zoom for crisp labels); keyframes timeline (morph timing is product-derived from frame order, not per-property keys); keeping the original export settings, PNG sequence and SVG export (runtime owns export; user approved the changes); custom bézier control (built-in curves owns easing curves).
- State/output mapping: frames.source media order → keyframe order → decode/normalize passes; frames.fit → normalize; motion.* plus timeline currentTimeSeconds/durationSeconds (getToolcraftTimelineLoopProgress) → interpolated path; shape.* → path paint; overlay.* → anchors, handles and labels; overlay.export → overlays in image/video export; appearance.background/export.includeBackground → runtime background; export.image.* / export.video.* → runtime artifacts drawn by morphExport at the export frame and timelineProgress.
- Verification: unit tests in src/morph/morph.test.ts cover parser, normaliser, sequence seam and each control mapping; browser specs e2e/product-morph-*.spec.ts cover every acceptance row through protected helpers; first delivery runs bare `npm run verify:delivery`. Measured performance was not run.
- Risks: Risk: uploaded SVG text effects, gradients, masks and images are ignored (geometry only), as in the original. Risk: a file above 4000 segments is rejected rather than slowing playback. Risk: label background widths in the SVG preview are estimated from monospace character width.

## Decisions

### Renderer

- Decision: SVG preview (vector-build scene pass) with Canvas 2D export (export pass), shared path and overlay geometry.
- Reason: Vector preview keeps paths, anchors and coordinate labels sharp at any zoom; runtime export needs pixels.
- Evidence: src/morph/MorphCanvas.tsx, src/morph/morph-draw.ts, src/morph/morph-pipeline.ts, rendererTechnique in src/morph/morph-performance-model.ts.

### View Interaction

- Decision: non-spatial.
- Reason: Flat 2D vector artwork with no camera.
- Evidence: appProductReadiness.viewInteraction; mode non-spatial; source product semantics; alternatives orbit/fixed-camera rejected because no 3D scene exists; targets none.

### Interaction Ownership

- Decision: Panel owns all settings and the frame list; canvas shows output only.
- Reason: The reference kept every control in a sidebar; overlays are inspection aids, not handles.
- Evidence: appProductReadiness.interactionOwnership in src/morph/morph-inventory.ts.

### Timeline

- Decision: Playback timeline, defaultDurationSeconds 6.8; Loop and Ping-pong are keyframe orders inside one forward loop that starts and ends on frame 1.
- Reason: The reference loop was 4 × (1.2 s + 0.5 s); timeline duration replaces the transition and speed sliders (user approved).
- Evidence: timelineModule in src/app/app-schema.ts; keyOrder/phaseAt in src/morph/morph-sequence.ts.

### Layers

- Decision: No Layers module.
- Reason: The user did not request a layer workflow; multiple uploads alone do not enable it.
- Evidence: modules list in src/app/app-schema.ts.

### Controls

- Decision: Sections Frames (upload), Fitting, Motion, Shape, Display after runtime Settings; easing select with a conditional curves control; Outline view gates fill and stroke controls.
- Reason: Entity-first grouping with branch selectors kept next to their dependents.
- Evidence: src/morph/morph-controls.ts and appControlSectionInventory in src/morph/morph-inventory.ts.

### Export

- Decision: Image (toolcraft-default PNG/JPG) and video (user-requested MP4/WebM); SVG not requested.
- Reason: The original request says "Add ability to export video  and images"; the user chose to drop SVG frame export.
- Evidence: exportIntent in src/morph/morph-inventory.ts.

### Performance

- Decision: Workload dimensions frames (≤5), segments per frame (≤4000, enforced at parse) and export resolution; decode and normalize are memoised per frame set; playback only rebuilds the scene pass.
- Reason: Interpolation cost grows with segment count; decoding must not run during playback.
- Evidence: workload envelope in src/morph/morph-performance-model.ts; paths derived in src/app/app-performance.ts; assessment run by the framework tests. Lifecycle: memoized source-scoped decode/normalize, renderer-scoped scene. No measured performance has been run.

Canonical control values and selected-entity isolation follow runtime representations; this product has no render scale.

## Evidence

- Source reviewed: Morphium index.html, Toolcraft local docs and the polar-signals example app for current API shapes.
- Contract applied: reference-runtime-clone with user-approved intentional changes recorded in referenceFeatureInventory.
- Workflow skills were not installed (the CLI's dependency step was interrupted); the signed local workflow was followed instead.

## Verification

Protected receipts own initial proof. Functional delivery only; measured performance was not run.

## Risks

- Risk: Geometry-only SVG import (no gradients, text, masks), matching the original.
