import { expect, type Download, type Page } from "@playwright/test";

import { createToolcraftBrowserProofSession } from "./browser-proof-session";
import { getToolcraftControlFieldByTarget } from "./browser-control-target-helpers";

export const outputSelector = '[data-testid="morph-output"]';
export const MID_MORPH = 0.15;

export async function openMorph(page: Page, { pauseAt = MID_MORPH }: { pauseAt?: number | null } = {}) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/");
  const session = await createToolcraftBrowserProofSession(page);
  await expect(page.locator(outputSelector)).toHaveAttribute("data-frame-ready", "true");
  await expect(page.locator(outputSelector)).toHaveAttribute("data-frame-count", "4");
  if (pauseAt !== null) await pauseTimelineAt(page, pauseAt);
  return session;
}

export async function showExtendedTimeline(page: Page) {
  const scrubber = page.getByRole("slider", { name: "Playback position" });
  if (!(await scrubber.isVisible())) {
    await (await getToolcraftControlFieldByTarget(page, "panels.timeline.extended")).getByRole("switch").click();
    await expect(scrubber).toBeVisible();
  }
  return scrubber;
}

export async function pausePlayback(page: Page) {
  const pause = page.getByRole("button", { name: "Pause playback" });
  if (await pause.isVisible()) await pause.click();
  await expect(page.getByRole("button", { name: "Play playback" })).toBeVisible();
}

/** Pauses and moves the playhead to a fraction of the loop by clicking the scrubber. */
export async function pauseTimelineAt(page: Page, ratio: number) {
  const scrubber = await showExtendedTimeline(page);
  await pausePlayback(page);
  await setTimelineRatio(page, ratio);
  await expect(page.locator(outputSelector)).toHaveAttribute("data-frame-ready", "true");
}

export async function setTimelineRatio(page: Page, ratio: number) {
  const scrubber = page.getByRole("slider", { name: "Playback position" });
  if (ratio <= 0) { await scrubber.press("Home"); return; }
  if (ratio >= 1) { await scrubber.press("End"); return; }
  const box = await scrubber.boundingBox();
  if (!box) throw new Error("Timeline scrubber is unavailable.");
  await page.mouse.click(box.x + box.width * ratio, box.y + box.height / 2);
}

export async function editDuration(page: Page, seconds: number) {
  await page.getByRole("button", { name: "Edit timeline duration" }).click();
  const editor = page.getByRole("textbox", { name: "timeline duration" });
  await editor.fill(String(seconds));
  await editor.press("Enter");
}

export const field = (page: Page, target: string) => getToolcraftControlFieldByTarget(page, target);

export async function setColor(page: Page, target: string, value: string) {
  const input = (await field(page, target)).getByRole("textbox");
  await input.fill(value);
  await input.press("Enter");
}

export async function selectOption(page: Page, target: string, label: string) {
  await (await field(page, target)).getByRole("combobox").click();
  await page.getByRole("option", { name: label, exact: true }).click();
}

export async function setSegment(page: Page, target: string, label: string) {
  await (await field(page, target)).getByRole("button", { name: label, exact: true }).click();
}

export async function setSwitch(page: Page, target: string, on: boolean) {
  const control = (await field(page, target)).getByRole("switch");
  if ((await control.isChecked()) !== on) await control.click();
  await expect(control).toBeChecked({ checked: on });
}

export async function setSlider(page: Page, target: string, value: number) {
  const f = await field(page, target);
  await f.getByRole("button", { name: /^Edit .* value$/ }).click();
  const input = f.getByRole("textbox");
  await expect(input).toBeFocused();
  await input.fill(String(value));
  await input.press("Enter");
  await expect(f.getByRole("button", { name: /^Edit .* value$/ })).toContainText(String(value));
}

/** Drags a slider thumb to a track fraction and keeps the pointer held. */
export async function holdSliderAt(page: Page, target: string, fraction: number) {
  const f = await field(page, target);
  const slider = f.getByRole("slider");
  await slider.scrollIntoViewIfNeeded();
  const track = await f.locator('[data-slot="slider"]').first().boundingBox();
  const thumb = await slider.boundingBox();
  if (!track || !thumb) throw new Error(`Slider ${target} is not visible.`);
  await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2);
  await page.mouse.down();
  await page.mouse.move(track.x + track.width * fraction, track.y + track.height / 2, { steps: 8 });
}

export async function downloadImage(page: Page): Promise<Download> {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: /^Export (PNG|JPG)$/ }).click();
  return pending;
}

export async function downloadVideo(page: Page): Promise<Download> {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: /^Export (MP4|WebM)$/ }).click();
  return pending;
}

/** Serialised path data of the rendered shape (a stable product-output signature). */
export async function shapeSignature(page: Page) {
  return page.locator('[data-testid="morph-shape"]').evaluate((node) =>
    `${node.getAttribute("d")}|${node.getAttribute("fill")}|${node.getAttribute("stroke")}|${node.getAttribute("stroke-width")}`);
}
