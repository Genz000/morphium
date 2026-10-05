import type { ToolcraftProductExportRenderer } from "@/toolcraft/runtime";

import { drawMorphFrame } from "./morph-draw";
import { cachedFrames, frameAssets, framesKey, normalizedFrames } from "./morph-frames";
import { exportPass } from "./morph-pipeline";
import { readMorphSettings } from "./morph-settings";
import { shapeAtProgress, stageMap } from "./morph-scene";

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
      const { shape } = shapeAtProgress(norm, timelineProgress, settings);
      const map = stageMap(frames[0].viewBox, frame);
      const ui = Math.min(frame.width, frame.height) / 600;
      const background = String(state.values["appearance.background"] ?? "#F4F1EA");
      drawMorphFrame(context, shape, map, settings, background, ui, settings.overlayExport);
      signal.throwIfAborted();
    };
    if (rendererPipeline) await rendererPipeline.runPass(exportPass, undefined, render);
    else render();
  },
};
