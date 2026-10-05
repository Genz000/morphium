import { expectToolcraftReferenceParity } from "./browser-acceptance-outcome-helpers";
import { expectToolcraftPersistenceState } from "./browser-state-evidence-helpers";
import { getToolcraftProductObservableSnapshot } from "./product-observable-helpers";
import { expect, test } from "./toolcraft-product-test";
import { editDuration, field, openMorph, outputSelector, setColor, setSegment } from "./morph-test-helpers";

test("browser: morph restores frames and workspace after reload", async ({ page }) => {
  const session = await openMorph(page);
  const infinity = page.getByRole("switch", { name: "Infinity canvas", exact: true });
  if (await infinity.isChecked()) await infinity.uncheck();
  const workspace = session.observe((root) => {
    const scene = root.querySelector<HTMLElement>("[data-toolcraft-editable-canvas]");
    const panel = root.querySelector<HTMLElement>('[data-panel-type="controls"]');
    const svg = root.querySelector('[data-testid="morph-output"]');
    return {
      width: scene?.style.width,
      frames: svg?.getAttribute("data-frame-count"),
      cycle: svg?.getAttribute("data-cycle-seconds"),
      fill: root.querySelector('[data-testid="morph-shape"]')?.getAttribute("fill"),
      labels: root.querySelectorAll('[data-testid="morph-anchor-labels"] text').length > 0,
      collapsed: !!root.querySelector('[aria-label="Expand controls"]'),
      offsetX: Number(panel?.dataset.panelOffsetX), offsetY: Number(panel?.dataset.panelOffsetY),
    };
  });
  let signature = "";
  const probe = { selector: outputSelector };
  await expectToolcraftPersistenceState(workspace, session.controlAction("canvas.size.width", async () => {
    await setColor(page, "canvas.size.width", "960");
    await setColor(page, "shape.fill", "#123456");
    await setSegment(page, "overlay.labels", "Anchors");
    await editDuration(page, 4);
    await (await field(page, "frames.source")).getByRole("button", { name: "Remove ring.svg", exact: true }).click();
    const handle = page.locator('[data-panel-type="controls"] [data-panel-drag-handle=""]').first();
    const box = await handle.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2 - 48, box!.y + box!.height / 2 + 24, { steps: 4 });
    await page.mouse.up();
    await page.getByRole("button", { name: "Collapse controls", exact: true }).click();
    await expect(page.locator(outputSelector)).toHaveAttribute("data-frame-count", "3");
    await expect(page.locator('[data-slot="toolcraft-runtime-app"]')).toHaveAttribute("data-toolcraft-persistence-status", "success");
    signature = await getToolcraftProductObservableSnapshot(page, probe);
  }), session.reload(), { width: "960px", frames: "3", cycle: "4", fill: "#123456", labels: true, collapsed: true, offsetX: -48, offsetY: 24 }, {
    requirementId: "persistence.reload", stabilityIntervalMs: 0,
    assertRestoredOutput: async () => {
      await expect(page.locator(outputSelector)).toHaveAttribute("data-frame-ready", "true");
      await expect.poll(() => getToolcraftProductObservableSnapshot(page, probe)).toBe(signature);
    },
  });
  await expectToolcraftReferenceParity(async () => page.locator(outputSelector).getAttribute("data-frame-count"), "3", {
    requirementId: "persistence.reload", target: "canvas.size.width",
  });
});
