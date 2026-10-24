import { expectToolcraftReferenceParity } from "./browser-acceptance-outcome-helpers";
import { expectToolcraftInfinityCanvasVideoExportEvidence } from "./browser-infinity-canvas-evidence";
import { expectToolcraftVideoExportArtifact } from "./browser-media-export-evidence";
import { expect, test } from "./toolcraft-product-test";
import { BACKGROUND_RGBA, oneSecondSchedule, videoSamples } from "./morph-export-fixtures";
import { downloadVideo, editDuration, openMorph, selectOption, setSwitch } from "./morph-test-helpers";

test("browser: morph video export delivers formats and sizes", async ({ page }) => {
  const session = await openMorph(page, { pauseAt: 0 });
  await setSwitch(page, "overlay.exportDots", false);
  await editDuration(page, 1);
  await expect(page.getByRole("slider", { name: "Playback position" })).toHaveAttribute("aria-valuemax", "1");
  const infinity = page.getByRole("switch", { name: "Infinity canvas", exact: true });
  if (await infinity.isChecked()) await infinity.uncheck();

  const cases = [["MP4", "video/mp4", "Current", 1920, 1080], ["WebM", "video/webm", "4K", 3840, 2160], ["WebM", "video/webm", "Current", 1920, 1080]] as const;
  let last;
  for (const [format, mediaType, resolution, width, height] of cases) {
    await selectOption(page, "export.video.format", format);
    await expect(page.getByRole("button", { name: `Export ${format}`, exact: true })).toBeVisible();
    await selectOption(page, "export.video.resolution", resolution);
    last = await expectToolcraftVideoExportArtifact(session.targetAction("actions.output", () => downloadVideo(page)), {
      page, requirementId: "export.video", backgroundRgba: BACKGROUND_RGBA, expectedMediaType: mediaType,
      expectedWidth: width, expectedHeight: height, expectedDurationSeconds: 1, schedule: oneSecondSchedule, expectedSamples: videoSamples, animated: true,
      additionalArtifactRequirements: [
        { requirementId: "export.video.format", target: "export.video.format" },
        { requirementId: "export.video.resolution", target: "export.video.resolution" },
      ],
    });
  }

  await infinity.check();
  const infinite = await expectToolcraftVideoExportArtifact(session.targetAction("actions.output", () => downloadVideo(page)), {
    page, requirementId: "export.video", backgroundRgba: BACKGROUND_RGBA, expectedMediaType: "video/webm",
    expectedWidth: 1920, expectedHeight: 1080, expectedDurationSeconds: 1, schedule: oneSecondSchedule, expectedSamples: videoSamples, animated: true,
  });
  await expectToolcraftInfinityCanvasVideoExportEvidence({ finite: last!.inspection, infinite: infinite.inspection }, {
    requirementId: "export.video", target: "actions.output",
    expectedFiniteSize: { width: 1920, height: 1080 }, expectedInfiniteSize: { width: 1920, height: 1080 },
  });
  await expectToolcraftReferenceParity(async () => [infinite.inspection.width, infinite.inspection.height], [1920, 1080], {
    requirementId: "export.video", target: "actions.output",
  });
});
