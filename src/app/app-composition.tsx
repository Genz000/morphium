import { getToolcraftFiniteArtboardRect } from "@/toolcraft/runtime";
import { composeToolcraftApp } from "@/toolcraft/runtime/react";

import { MorphCanvas } from "../morph/MorphCanvas";
import { morphExport } from "../morph/morph-export";
import { morphPipeline } from "../morph/morph-pipeline";
import { CENTER_ACTION } from "../morph/morph-settings";
import { appSchema } from "./app-schema";

export const appComposition = composeToolcraftApp(appSchema, {
  scene: {
    canvasContent: <MorphCanvas />,
    renderDefaultCanvasMedia: false,
    sceneBoundsProvider: ({ state }) => [getToolcraftFiniteArtboardRect(state.canvas.size)],
    rasterFrameRenderer: morphExport,
  },
  renderer: { pipelineRegistration: morphPipeline },
  actions: {
    onPanelAction: ({ action, dispatch }) => {
      // Center: Position X and Y back to their defaults (0 = centred on the canvas).
      if (action.value === CENTER_ACTION) dispatch({ type: "controls.resetTargets", targets: ["frames.x", "frames.y"], label: "Center artwork" });
    },
  },
});
