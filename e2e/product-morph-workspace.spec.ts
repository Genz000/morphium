import type { Page } from "@playwright/test";

import { expectToolcraftReferenceParity } from "./browser-acceptance-outcome-helpers";
import { expectToolcraftInfinityCanvasModeEvidence, observeInfinityCanvas } from "./browser-infinity-canvas-evidence";
import { expectToolcraftViewportSideEffect } from "./browser-state-evidence-helpers";
import { expectToolcraftProductObservableToChange } from "./product-observable-helpers";
import { expect, test } from "./toolcraft-product-test";
import { openMorph, outputSelector, setColor } from "./morph-test-helpers";

async function fitScene(page: Page) {
  const infinity = page.getByRole("switch", { name: "Infinity canvas", exact: true });
  if (await infinity.isChecked()) await infinity.uncheck();
  await setColor(page, "canvas.size.width", "960");
  await page.getByRole("button", { name: "Center canvas", exact: true }).click();
  await expect(page.locator(outputSelector)).toHaveAttribute("data-frame-ready", "true");
}

async function continuity(page: Page, action: () => Promise<void>) {
  const host = await page.locator("[data-toolcraft-product-scene]").elementHandle();
  const output = await page.locator(outputSelector).elementHandle();
  await action();
  return {
    productHostPreserved: await host!.evaluate((node) => node.isConnected && node === document.querySelector("[data-toolcraft-product-scene]")),
    productOutputPreserved: await output!.evaluate((node) => node.isConnected && node === document.querySelector('[data-testid="morph-output"]')),
  };
}

test("browser: morph canvas sizing changes output", async ({ page }) => {
  const session = await openMorph(page);
  const infinity = page.getByRole("switch", { name: "Infinity canvas", exact: true });
  if (await infinity.isChecked()) await infinity.uncheck();
  await expectToolcraftProductObservableToChange(session, session.controlAction("canvas.size.width", () => setColor(page, "canvas.size.width", "960")), {
    requirementId: "canvas.size", selector: outputSelector,
  });
  await expectToolcraftReferenceParity(async () => page.locator(outputSelector).getAttribute("viewBox"), "0 0 960 540", {
    requirementId: "canvas.size", target: "canvas.size.width",
  });
});

test("browser: morph infinity preserves scene and viewport", async ({ page }) => {
  const session = await openMorph(page);
  const toggle = page.getByRole("switch", { name: "Infinity canvas", exact: true });
  await fitScene(page);
  const before = await observeInfinityCanvas(page);
  const beforeToEnabled = await continuity(page, () => toggle.check());
  const enabled = await observeInfinityCanvas(page);
  await expect(page.getByRole("textbox", { name: "Canvas width", exact: true })).toHaveCount(0);

  const viewport = session.observe((root) => {
    const world = root.querySelector<HTMLElement>("[data-toolcraft-canvas-world]");
    const svg = root.querySelector<SVGSVGElement>('[data-testid="morph-output"]');
    const match = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)(?:\s*scale\(([-\d.]+)\))?/.exec(world?.style.transform ?? "");
    return {
      offsetX: Number(match?.[1] ?? 0), offsetY: Number(match?.[2] ?? 0), zoom: Number(match?.[3] ?? 1),
      outputWidth: Number(svg?.viewBox.baseVal.width), outputHeight: Number(svg?.viewBox.baseVal.height),
    };
  });
  const start = await page.evaluate(() => {
    const world = document.querySelector<HTMLElement>("[data-toolcraft-canvas-world]");
    const match = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)(?:\s*scale\(([-\d.]+)\))?/.exec(world?.style.transform ?? "");
    return { x: Number(match?.[1] ?? 0), y: Number(match?.[2] ?? 0), zoom: Number(match?.[3] ?? 1) };
  });
  await expectToolcraftViewportSideEffect(viewport, session.targetAction("canvas.infinity", async () => {
    await page.mouse.move(180, 200);
    await page.keyboard.down("Space");
    await page.mouse.down();
    await page.mouse.move(224, 228, { steps: 6 });
    await page.mouse.up();
    await page.keyboard.up("Space");
  }), { offsetX: start.x + 44, offsetY: start.y + 28, zoom: start.zoom, outputWidth: 960, outputHeight: 540 }, { requirementId: "canvas.infinity" });
  const afterPan = await observeInfinityCanvas(page);

  await expect(page.locator('[data-slot="toolcraft-runtime-app"]')).toHaveAttribute("data-toolcraft-persistence-status", "success");
  await page.reload();
  await expect(page.locator(outputSelector)).toHaveAttribute("data-frame-ready", "true");
  const afterReload = await observeInfinityCanvas(page);
  const afterReloadToRestored = await continuity(page, () => toggle.uncheck());
  const restored = await observeInfinityCanvas(page);
  const restoredToUndone = await continuity(page, () => page.getByRole("button", { name: "Undo", exact: true }).click());
  const undone = await observeInfinityCanvas(page);
  const undoneToRedone = await continuity(page, () => page.getByRole("button", { name: "Redo", exact: true }).click());
  const redone = await observeInfinityCanvas(page);
  await expectToolcraftInfinityCanvasModeEvidence(
    { before, enabled, afterPan, afterReload, restored, undone, redone },
    { beforeToEnabled, afterReloadToRestored, restoredToUndone, undoneToRedone },
    { expectedFiniteSize: { width: 960, height: 540 }, expectedSceneRect: { x: -480, y: -270, width: 960, height: 540 }, requirementId: "canvas.infinity", target: "canvas.infinity" },
  );
  await expectToolcraftReferenceParity(async () => page.locator(outputSelector).getAttribute("viewBox"), "0 0 960 540", { requirementId: "canvas.infinity", target: "canvas.infinity" });
});
