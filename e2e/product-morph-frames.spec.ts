import { Buffer } from "node:buffer";

import { expectToolcraftReferenceParity } from "./browser-acceptance-outcome-helpers";
import { expectToolcraftMediaLifecycle } from "./browser-state-evidence-helpers";
import { expect, test } from "./toolcraft-product-test";
import { field, openMorph, outputSelector, shapeSignature } from "./morph-test-helpers";

const svgFile = (name: string, body: string) => ({
  name, mimeType: "image/svg+xml",
  buffer: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">${body}</svg>`),
});
const DEFAULT_IDS = ["demo-frame-1", "demo-frame-2", "demo-frame-3", "demo-frame-4"];

test("browser: morph frames upload, remove, reorder and reset", async ({ page }) => {
  const session = await openMorph(page);
  const list = await field(page, "frames.source");
  const items = list.locator("[data-file-upload-preview-key]");
  const ids = () => items.evaluateAll((all) => all.map((el) => el.getAttribute("data-file-upload-preview-key")!));
  const output = page.locator(outputSelector);
  await expect.poll(ids).toEqual(DEFAULT_IDS);

  const lifecycle = session.observe((root) => ({
    itemIds: Array.from(root.querySelectorAll('[data-toolcraft-control-target="frames.source"] [data-file-upload-preview-key]'), (el) => el.getAttribute("data-file-upload-preview-key")!),
    outputSignature: `${root.querySelector('[data-testid="morph-output"]')?.getAttribute("data-frame-count")}|${root.querySelector('[data-testid="morph-shape"]') ? "shape" : "empty"}`,
  }));

  // Removing every default frame empties the list and the canvas.
  await expectToolcraftMediaLifecycle(lifecycle, session.targetAction("frames.source", async () => {
    const remove = list.getByRole("button", { name: /^Remove / });
    while (await remove.count()) await remove.first().click();
  }), { itemIds: [], outputSignature: "0|empty" }, { requirementId: "frames.source" });

  // Section reset restores the four demo frames.
  await page.getByRole("button", { name: "Reset Frames section", exact: true }).click();
  await expect.poll(ids).toEqual(DEFAULT_IDS);
  await expect(output).toHaveAttribute("data-frame-count", "4");
  const fourFrames = await shapeSignature(page);

  // Upload adds a fifth frame at the end of the sequence; a sixth is refused (limit 5).
  const input = list.locator('input[type="file"]');
  await input.setInputFiles([svgFile("square.svg", '<rect x="60" y="60" width="280" height="280"/>')]);
  await expect.poll(async () => (await ids()).length).toBe(5);
  await expect(output).toHaveAttribute("data-frame-count", "5");
  await expect(list.getByText("square.svg", { exact: true })).toBeVisible();
  await input.setInputFiles([svgFile("extra.svg", '<circle cx="200" cy="200" r="50"/>')]);
  await page.waitForTimeout(500);
  expect(await ids()).toHaveLength(5);
  await expect(output).toHaveAttribute("data-frame-count", "5");

  // Remove one frame: the morph sequence loses it.
  await list.getByRole("button", { name: "Remove square.svg", exact: true }).click();
  await expect.poll(ids).toEqual(DEFAULT_IDS);
  await expect.poll(() => shapeSignature(page)).toBe(fourFrames);

  // Reordering changes the morph order: star becomes the first keyframe.
  const from = await list.getByRole("button", { name: "Reorder star.svg", exact: true }).boundingBox();
  const to = await list.getByRole("button", { name: "Reorder circle.svg", exact: true }).boundingBox();
  if (!from || !to) throw new Error("Reorder handles must be visible.");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 - 6);
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2 - 4, { steps: 10 });
  await page.mouse.up();
  await expect.poll(ids).toEqual(["demo-frame-2", "demo-frame-1", "demo-frame-3", "demo-frame-4"]);
  await expect.poll(() => shapeSignature(page)).not.toBe(fourFrames);

  // Removing a default frame and resetting restores defaults in their original order.
  await list.getByRole("button", { name: "Remove ring.svg", exact: true }).click();
  await expect(output).toHaveAttribute("data-frame-count", "3");
  await page.getByRole("button", { name: "Reset Frames section", exact: true }).click();
  await expect.poll(ids).toEqual(DEFAULT_IDS);
  await expectToolcraftReferenceParity(ids, DEFAULT_IDS, { requirementId: "frames.source", target: "frames.source" });
});
