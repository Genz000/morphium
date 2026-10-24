import { expectToolcraftReferenceParity } from "./browser-acceptance-outcome-helpers";
import { expectToolcraftInfinityCanvasImageExportEvidence } from "./browser-infinity-canvas-evidence";
import { expectToolcraftImageExportArtifact, expectToolcraftVideoExportArtifact } from "./browser-media-export-evidence";
import { inspectToolcraftImageDownload } from "./image-artifact-inspection";
import { expect, test } from "./toolcraft-product-test";
import { BACKGROUND_RGBA, circleBounds, circlePixels, oneSecondSchedule, videoSamples } from "./morph-export-fixtures";
import { downloadImage, downloadVideo, editDuration, openMorph, selectOption, setSwitch } from "./morph-test-helpers";

test("browser: morph image export delivers all formats and sizes", async ({ page }) => {
  const session = await openMorph(page, { pauseAt: 0 });
  await setSwitch(page, "overlay.exportDots", false);
  const infinity = page.getByRole("switch", { name: "Infinity canvas", exact: true });
  if (await infinity.isChecked()) await infinity.uncheck();
  for (const [format, mediaType] of [["PNG", "image/png"], ["JPG", "image/jpeg"]] as const) {
    await selectOption(page, "export.image.format", format);
    await expect(page.getByRole("button", { name: `Export ${format}`, exact: true })).toBeVisible();
    for (const [resolution, width] of [["2K", 2048], ["4K", 4096], ["8K", 8192]] as const) {
      await selectOption(page, "export.image.resolution", resolution);
      await expectToolcraftImageExportArtifact(session.targetAction("actions.output", () => downloadImage(page)), {
        page, requirementId: "export.image", backgroundRgba: BACKGROUND_RGBA, expectedBounds: circleBounds, expectedPixels: circlePixels,
        expectedWidth: width, expectedHeight: (width * 9) / 16, expectedMediaType: mediaType,
        additionalArtifactRequirements: [
          { requirementId: "export.image.format", target: "export.image.format" },
          { requirementId: "export.image.resolution", target: "export.image.resolution" },
        ],
      });
    }
  }
  await selectOption(page, "export.image.format", "PNG");
  await selectOption(page, "export.image.resolution", "2K");
  const finite = (await inspectToolcraftImageDownload({ page, download: await downloadImage(page), backgroundRgba: BACKGROUND_RGBA })).inspection;
  await infinity.check();
  const infinite = (await inspectToolcraftImageDownload({ page, download: await downloadImage(page), backgroundRgba: BACKGROUND_RGBA })).inspection;
  await expectToolcraftInfinityCanvasImageExportEvidence({ finite, infinite }, {
    expectedSize: { width: 2048, height: 1152 }, requirementId: "export.image", target: "actions.output",
  });
  await expectToolcraftReferenceParity(async () => [infinite.width / infinite.height, infinite.decodedPixelHash === finite.decodedPixelHash], [16 / 9, true], {
    requirementId: "export.image", target: "actions.output",
  });
});

test("browser: morph footer exports PNG and video", async ({ page }) => {
  const session = await openMorph(page, { pauseAt: 0 });
  await setSwitch(page, "overlay.exportDots", false);
  await editDuration(page, 1);
  await selectOption(page, "export.image.resolution", "2K");
  await expectToolcraftImageExportArtifact(session.targetAction("actions.output", () => downloadImage(page)), {
    page, requirementId: "export.actions", backgroundRgba: BACKGROUND_RGBA, expectedBounds: circleBounds, expectedPixels: circlePixels,
    expectedWidth: 2048, expectedHeight: 1152, expectedMediaType: "image/png",
  });
  await selectOption(page, "export.video.format", "WebM");
  await expectToolcraftVideoExportArtifact(session.targetAction("actions.output", () => downloadVideo(page)), {
    page, requirementId: "export.actions", backgroundRgba: BACKGROUND_RGBA, expectedMediaType: "video/webm",
    expectedWidth: 1920, expectedHeight: 1080, expectedDurationSeconds: 1, schedule: oneSecondSchedule, expectedSamples: videoSamples, animated: true,
  });
});
