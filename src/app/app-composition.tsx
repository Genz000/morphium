import { getToolcraftFiniteArtboardRect } from "@/toolcraft/runtime";
import { composeToolcraftApp } from "@/toolcraft/runtime/react";

import { MorphCanvas } from "../morph/MorphCanvas";
import { morphExport } from "../morph/morph-export";
import { morphPipeline } from "../morph/morph-pipeline";
import { appSchema } from "./app-schema";

export const appComposition = composeToolcraftApp(appSchema, {
  scene: {
    canvasContent: <MorphCanvas />,
    renderDefaultCanvasMedia: false,
    sceneBoundsProvider: ({ state }) => [getToolcraftFiniteArtboardRect(state.canvas.size)],
    rasterFrameRenderer: morphExport,
  },
  renderer: { pipelineRegistration: morphPipeline },
});
