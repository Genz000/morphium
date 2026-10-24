import {
  defineToolcraft, imageExportModule, mediaSourceModule, timelineModule, videoExportModule,
} from "@/toolcraft/runtime";

import { backgroundControls, displayControls, fittingControls, frameControls, lastFrameControls, motionControls, shapeControls } from "../morph/morph-controls";
import { defaultFrameAssets } from "../morph/morph-default-assets";
import { REFERENCE_LOOP_SECONDS } from "../morph/morph-reference";
import appDefaults from "./app-defaults.json" with { type: "json" };
import { appIdentity } from "./app-identity";

export const appSchema = defineToolcraft({
  defaults: appDefaults,
  base: {
    canvas: {
      enabled: true,
      upload: true,
      draggable: true,
      size: { width: 1920, height: 1080, unit: "px" },
      sizing: { mode: "editable-output" },
    },
    identity: appIdentity,
    media: { defaultAssets: defaultFrameAssets },
    panels: {
      controls: {
        sections: [
          { id: "runtime.setup", title: "Settings", controls: backgroundControls },
          { id: "frames", title: "Frames", controls: frameControls },
          { id: "frame-fitting", title: "Fitting", controls: fittingControls },
          { id: "motion", title: "Motion", controls: motionControls },
          { id: "shape", title: "Shape", controls: shapeControls },
          { id: "last-frame", title: "Last Frame", controls: lastFrameControls },
          { id: "display", title: "Display", controls: displayControls },
        ],
        title: "Controls",
      },
    },
    toolbar: {
      history: true,
      radar: true,
      theme: true,
      zoom: true,
    },
  },
  modules: [
    mediaSourceModule(),
    timelineModule({ mode: "playback", defaultDurationSeconds: REFERENCE_LOOP_SECONDS }),
    imageExportModule(),
    videoExportModule(),
  ],
});
