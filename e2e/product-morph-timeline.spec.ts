import type { Page } from "@playwright/test";

import { expectToolcraftReferenceParity } from "./browser-acceptance-outcome-helpers";
import type { ToolcraftBrowserProofSession } from "./browser-proof-session";
import {
  expectToolcraftTimelineDuration, expectToolcraftTimelineLoop, expectToolcraftTimelinePauseResume, expectToolcraftTimelineRenderedFrame,
  expectToolcraftTimelineScrub, type ToolcraftTimelineLoopCycleProof, type ToolcraftTimelineLoopProof,
} from "./browser-timeline-evidence-helpers";
import { expectToolcraftProductObservableToChange } from "./product-observable-helpers";
import { expect, test } from "./toolcraft-product-test";
import { editDuration, openMorph, outputSelector, pausePlayback, setTimelineRatio, shapeSignature } from "./morph-test-helpers";

const requirementId = "timeline.playback";
const scrubberSelector = '[role="slider"][aria-label="Playback position"]';

function observeFrame(session: ToolcraftBrowserProofSession) {
  return session.observe((root) => ({
    currentTimeSeconds: Number(root.querySelector(scrubberSelector)?.getAttribute("aria-valuenow")),
    outputSignature: root.querySelector('[data-testid="morph-shape"]')?.getAttribute("d") ?? "",
  }));
}

async function collectLoopCycle(page: Page): Promise<ToolcraftTimelineLoopCycleProof> {
  const scrubber = page.getByRole("slider", { name: "Playback position" });
  const durationSeconds = Number(await scrubber.getAttribute("aria-valuemax"));
  await scrubber.press("Home");
  const seamStartSignature = await shapeSignature(page);
  await scrubber.press("End");
  const seamEndSignature = await shapeSignature(page);
  await scrubber.press("Home");
  await page.getByRole("button", { name: "Play playback" }).click();
  const normalizedPhases: number[] = [];
  let wrapped = false;
  for (let sample = 0; sample < 120; sample += 1) {
    await page.waitForTimeout(80);
    const phase = Number(await page.locator(outputSelector).getAttribute("data-loop-progress"));
    const previous = normalizedPhases.at(-1);
    if (previous === undefined || Math.abs(phase - previous) > 0.001) {
      if (previous !== undefined && phase < previous) wrapped = true;
      normalizedPhases.push(phase);
    }
    if (wrapped && normalizedPhases.length >= 5 && phase > normalizedPhases[normalizedPhases.length - 2]!) break;
  }
  await pausePlayback(page);
  expect(wrapped).toBe(true);
  return { durationSeconds, normalizedPhases, seamEndSignature, seamStartSignature };
}

test("browser: morph timeline plays, scrubs, changes duration and loops", async ({ page }) => {
  const session = await openMorph(page, { pauseAt: 0 });
  const scrubber = page.getByRole("slider", { name: "Playback position" });
  await expect(scrubber).toHaveAttribute("aria-valuemax", "6.8");
  const start = await shapeSignature(page);
  const startPath = (await page.locator('[data-testid="morph-shape"]').getAttribute("d"))!;

  await expectToolcraftProductObservableToChange(session, session.targetAction("timeline", () => setTimelineRatio(page, 0.15)), {
    requirementId, selector: outputSelector,
  });
  await scrubber.press("Home");
  await expect.poll(() => shapeSignature(page)).toBe(start);

  // Frame 2 (star) holds from 25% to 32.5% of the default loop.
  await setTimelineRatio(page, 0.29);
  const star = await page.locator('[data-testid="morph-shape"]').getAttribute("d");
  const time = Number(await scrubber.getAttribute("aria-valuenow"));
  await scrubber.press("Home");
  const frames = observeFrame(session);
  await expectToolcraftTimelineScrub(frames, session.targetAction("timeline", () => setTimelineRatio(page, 0.29)),
    { currentTimeSeconds: time, outputSignature: star! }, { requirementId });
  await expectToolcraftTimelineRenderedFrame(frames, session.targetAction("timeline", () => scrubber.press("Home")),
    { currentTimeSeconds: 0, outputSignature: startPath }, { requirementId });

  const initial = await collectLoopCycle(page);
  await expectToolcraftTimelineDuration(
    session.observe((root) => {
      const svg = root.querySelector('[data-testid="morph-output"]');
      return {
        renderedCycleDurationSeconds: Number(svg?.getAttribute("data-cycle-seconds")),
        timelineDurationSeconds: Number(root.querySelector(scrubberSelector)?.getAttribute("aria-valuemax")),
      };
    }),
    session.targetAction("timeline", () => editDuration(page, 3.4)), 3.4, { requirementId },
  );
  const resized = await collectLoopCycle(page);
  const proof: ToolcraftTimelineLoopProof = { initial, resized };
  await page.evaluate((value) => { (window as unknown as { __morphLoopProof: ToolcraftTimelineLoopProof }).__morphLoopProof = value; }, proof);
  await expectToolcraftTimelineLoop(session.observe(() => (window as unknown as { __morphLoopProof: ToolcraftTimelineLoopProof }).__morphLoopProof), { requirementId });

  await page.getByRole("button", { name: "Play playback" }).click();
  await expect.poll(() => scrubber.getAttribute("aria-valuenow")).not.toBe("0");
  await expectToolcraftTimelinePauseResume(
    session.observe((root) => ({
      currentTimeSeconds: Number(root.querySelector(scrubberSelector)?.getAttribute("aria-valuenow")),
      outputSignature: root.querySelector('[data-testid="morph-shape"]')?.getAttribute("d") ?? "",
      playing: Boolean(root.querySelector('[aria-label="Pause playback"]')),
    })),
    session.targetAction("timeline", () => page.getByRole("button", { name: "Pause playback" }).click()),
    session.targetAction("timeline", () => page.getByRole("button", { name: "Play playback" }).click()),
    { requirementId },
  );
  await pausePlayback(page);
  await expectToolcraftReferenceParity(async () => Number(await scrubber.getAttribute("aria-valuemax")), 3.4, { requirementId, target: "timeline" });
});
