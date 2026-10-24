import type { ToolcraftProductExportRenderer } from "@/toolcraft/runtime";

import { drawMorphFrame, drawWorkspace } from "./morph-draw";
import { workspaceColors } from "./morph-workspace";
import { cachedFrames, frameAssets, framesKey, normalizedFrames } from "./morph-frames";
import { exportPass } from "./morph-pipeline";
import { readMorphSettings } from "./morph-settings";
import { lastFrameWeight, shapeAtProgress, stageMap } from "./morph-scene";

/**
 * Shared image/video frame. Uses the frames the live preview decoded (same
 * resources, same normalisation) and the export's own timeline progress.
 */
export const morphExport: ToolcraftProductExportRenderer = {
  baseFileName: "morphium",
  async renderFrame({ context, frame, state, rendererPipeline, signal, timelineProgress }) {
    const render = () => {
      signal.throwIfAborted();
      const assets = frameAssets(state.mediaAssets);
      const frames = cachedFrames(assets);
      if (!frames) throw new Error("Frames are still loading. Try the export again in a moment.");
      if (!frames.length) return;
      const settings = readMorphSettings(state.values);
      const norm = normalizedFrames(frames, framesKey(assets), settings.fit);
      const { shape, phase } = shapeAtProgress(norm, timelineProgress, settings);
      const map = stageMap(frames[0].viewBox, frame, settings.scale / 100);
      const ui = Math.min(frame.width, frame.height) / 600;
      // Background off shows the editor workspace in the preview; export the same backdrop.
      const workspace = workspaceColors();
      const showWorkspace = settings.exportDots && state.values["export.includeBackground"] === false;
      if (showWorkspace) drawWorkspace(context, frame, workspace, state.values["canvas.workspaceBackground"] === "dots");
      const background = showWorkspace ? workspace.background : String(state.values["appearance.background"] ?? "#F4F1EA");
      drawMorphFrame(context, shape, map, settings, background, ui, settings.overlayExport, lastFrameWeight(phase, norm.length));
      signal.throwIfAborted();
    };
    if (rendererPipeline) await rendererPipeline.runPass(exportPass, undefined, render);
    else render();
  },
};
