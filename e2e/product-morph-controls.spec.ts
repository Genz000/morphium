import type { Page } from "@playwright/test";

import {
  getToolcraftApplicabilityRequirementId, getToolcraftControlApplicabilityCases, type ToolcraftControlApplicabilityCase,
} from "../src/app/app-acceptance";
import { appAcceptance, appControlSectionInventory } from "../src/app/app-acceptance-data";
import { appSchema } from "../src/app/app-schema";
import { expectToolcraftExportedArtifact, expectToolcraftReferenceParity } from "./browser-acceptance-outcome-helpers";
import { expectToolcraftControlApplicabilityState } from "./browser-control-applicability-evidence";
import type { ToolcraftBrowserProofSession } from "./browser-proof-session";
import { expectToolcraftCompoundControlPartOutcome } from "./browser-state-evidence-helpers";
import { inspectToolcraftImageDownload } from "./image-artifact-inspection";
import { expectToolcraftSegmentedControlCellsPreservePadding } from "./performance-control-layout-helpers";
import { expectToolcraftProductObservableToChange } from "./product-observable-helpers";
import { expect, test } from "./toolcraft-product-test";
import {
  downloadImage, field, holdSliderAt, openMorph, outputSelector, pauseTimelineAt, selectOption, setColor, setSegment,
  setSlider, setSwitch,
} from "./morph-test-helpers";

type Ctx = { page: Page; session: ToolcraftBrowserProofSession; target: string; requirementId: string; round: number };
type Spec = { prepare?: (page: Page) => Promise<void>; prove: (ctx: Ctx) => Promise<void> };

const change = ({ session, target, requirementId }: Ctx, act: () => Promise<void>) =>
  expectToolcraftProductObservableToChange(session, session.controlAction(target, act), { requirementId, selector: outputSelector });

/** Selector defaults that keep every dependent control reachable. */
const selectorDefaults: Record<string, boolean | string> = {
  "shape.outline": false, "shape.fillOn": true, "lastFrame.on": true, "overlay.anchors": true, "overlay.handles": true,
};

async function setSelector(page: Page, target: string, value: unknown, optionLabel?: string) {
  if (typeof value === "boolean") await setSwitch(page, target, value);
  else if (optionLabel) {
    const control = await field(page, target);
    if (await control.getByRole("combobox").count()) await selectOption(page, target, optionLabel);
    else await setSegment(page, target, optionLabel);
  }
}

function branchAction(session: ToolcraftBrowserProofSession, c: ToolcraftControlApplicabilityCase) {
  return session.controlAction(c.selectorTarget, async (control) => {
    const page = control.page();
    await setSelector(page, c.selectorTarget, c.selectorValue, c.selectorOptionLabel);
  });
}

async function cycleSegment(ctx: Ctx) {
  const control = await field(ctx.page, ctx.target);
  const buttons = control.locator('[data-slot="toggle-group"] button');
  const labels = (await buttons.allInnerTexts()).map((l) => l.trim());
  const pressed = await buttons.evaluateAll((all) => all.findIndex((b) => b.getAttribute("aria-pressed") === "true" || b.getAttribute("data-state") === "on"));
  const order = [...labels.slice(pressed + 1), ...labels.slice(0, pressed + 1)];
  for (const label of order) await change(ctx, () => setSegment(ctx.page, ctx.target, label));
  await expectToolcraftSegmentedControlCellsPreservePadding(ctx.page, labels.join(" "), { target: ctx.target, requirementId: ctx.requirementId });
}

const toggle = async (ctx: Ctx) => {
  const sw = (await field(ctx.page, ctx.target)).getByRole("switch");
  const initial = await sw.isChecked();
  await change(ctx, () => setSwitch(ctx.page, ctx.target, !initial));
  await change(ctx, () => setSwitch(ctx.page, ctx.target, initial));
};

const color = (values: readonly string[]) => async (ctx: Ctx) => {
  const current = (await (await field(ctx.page, ctx.target)).getByRole("textbox").inputValue()).toUpperCase();
  const value = values.find((v, i) => i >= ctx.round % values.length && v !== current) ?? values.find((v) => v !== current)!;
  await change(ctx, () => setColor(ctx.page, ctx.target, value));
};

const slider = (fractions: readonly number[]) => async (ctx: Ctx) => {
  // The preview must update while the pointer is still held, not only on release.
  await change(ctx, () => holdSliderAt(ctx.page, ctx.target, fractions[ctx.round % fractions.length]));
  await ctx.page.mouse.up();
};

const specs: Record<string, Spec> = {
  "frames.fit": { prove: cycleSegment },
  "motion.sequence": { prepare: (page) => pauseTimelineAt(page, 0.6), prove: cycleSegment },
  "motion.delay": { prove: slider([0.85, 0.1, 0.5]) },
  "motion.duration": { prove: slider([0.8, 0.1, 0.5]) },
  "motion.easing": {
    prove: async (ctx) => {
      await (await field(ctx.page, ctx.target)).getByRole("combobox").click();
      const names = (await ctx.page.getByRole("option").allInnerTexts()).map((n) => n.trim());
      await ctx.page.keyboard.press("Escape");
      expect(names).toHaveLength(21);
      for (const label of [...names.filter((n) => n !== "Cubic in-out"), "Cubic in-out"]) {
        await change(ctx, () => selectOption(ctx.page, ctx.target, label));
      }
    },
  },
  "motion.curve": {
    prove: async (ctx) => {
      const point = (await field(ctx.page, ctx.target)).locator('[data-slot="curve-point-handle"]').nth(1);
      await expect(point).toBeVisible();
      const shape = ctx.page.locator('[data-testid="morph-shape"]');
      const before = await shape.getAttribute("d");
      const drag = async () => {
        const box = await point.boundingBox();
        if (!box) throw new Error("Curve point is not visible.");
        await ctx.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await ctx.page.mouse.down();
        await ctx.page.mouse.move(box.x + box.width / 2 - 20, box.y + box.height / 2 - 60, { steps: 6 });
        await ctx.page.mouse.up();
      };
      await change(ctx, drag);
      const after = await shape.getAttribute("d");
      expect(after).not.toBe(before);
      // Replaying the same point drag after Undo must give the same shape: the curve points drive the morph.
      await ctx.page.getByRole("button", { name: "Undo", exact: true }).click();
      await expect(shape).toHaveAttribute("d", before!);
      const caseSuffix = ctx.requirementId.slice(ctx.target.length);
      await expectToolcraftCompoundControlPartOutcome(
        ctx.session.observe((root) => root.querySelector('[data-testid="morph-shape"]')?.getAttribute("d") ?? ""),
        ctx.session.controlAction(ctx.target, drag), after!, { requirementId: ctx.target, part: `curves.points${caseSuffix}` },
      );
    },
  },
  "shape.outline": { prove: toggle },
  "shape.fillOn": { prove: toggle },
  "shape.fill": { prove: color(["#2255FF", "#AA1144", "#22AA66"]) },
  "shape.stroke": { prepare: (page) => setSlider(page, "shape.strokeWidth", 8), prove: color(["#00AA44", "#4400AA", "#AA6600"]) },
  "shape.strokeWidth": { prove: slider([0.4, 0.15, 0.7]) },
  "shape.lineJoin": {
    prepare: async (page) => { await setSlider(page, "shape.strokeWidth", 14); await pauseTimelineAt(page, 0.28); },
    prove: cycleSegment,
  },
  "lastFrame.on": { prepare: (page) => pauseTimelineAt(page, 0.78), prove: toggle },
  "lastFrame.style": { prepare: (page) => pauseTimelineAt(page, 0.78), prove: cycleSegment },
  "lastFrame.fill": { prepare: (page) => pauseTimelineAt(page, 0.78), prove: color(["#2F5BFF", "#22AA66", "#AA1144"]) },
  "overlay.anchors": { prove: toggle },
  "overlay.anchorColor": { prove: color(["#AA00FF", "#00CCAA"]) },
  "overlay.handles": { prove: toggle },
  "overlay.handleColor": { prove: color(["#FFAA00", "#0066FF"]) },
  "overlay.pointSize": { prove: slider([0.9, 0.1]) },
  "overlay.labels": { prove: cycleSegment },
  "overlay.decimals": { prove: cycleSegment },
  "overlay.labelSize": { prove: slider([0.9, 0.1, 0.5]) },
};

const parityRead: Record<string, (page: Page, target: string) => Promise<unknown>> = {
  switch: async (page, target) => (await field(page, target)).getByRole("switch").isChecked(),
  color: async (page, target) => (await field(page, target)).getByRole("textbox").inputValue(),
};

for (const [target, spec] of Object.entries(specs)) {
  const row = appAcceptance.find((r) => r.id === target)!;
  test(row.browser ? row.browser.testName : target, async ({ page }) => {
    const session = await openMorph(page);
    await spec.prepare?.(page);
    const cases = getToolcraftControlApplicabilityCases({ schema: appSchema, sectionInventory: appControlSectionInventory, target });
    const runs: string[] = [];
    if (!cases.length) runs.push(target);
    let round = 0;
    for (const c of cases) {
      for (const [selector, value] of Object.entries(selectorDefaults)) {
        if (selector !== c.selectorTarget && selector !== target && (await (await page.locator(`[data-toolcraft-control-target="${selector}"]`).count()))) {
          await setSwitch(page, selector, value as boolean);
        }
      }
      await expectToolcraftControlApplicabilityState(session, branchAction(session, c), c, { baseRequirementId: row.id });
      if (c.expectation === "hidden") continue;
      const requirementId = getToolcraftApplicabilityRequirementId(row.id, c);
      await spec.prove({ page, session, target, requirementId, round: round++ });
      runs.push(requirementId);
    }
    if (!cases.length) await spec.prove({ page, session, target, requirementId: target, round: 0 });
    if (row.referenceCoverage) {
      for (const requirementId of runs) {
        const read = parityRead[row.componentType];
        const value = read ? await read(page, target) : await page.locator('[data-testid="morph-shape"]').getAttribute("d");
        await expectToolcraftReferenceParity(async () => (read ? read(page, target) : page.locator('[data-testid="morph-shape"]').getAttribute("d")), value, { requirementId, target });
      }
    }
  });
}

test("browser: morph parameter overlay.export", async ({ page }) => {
  const session = await openMorph(page);
  await selectOption(page, "export.image.resolution", "2K");
  const background = [244, 241, 234, 255] as const;
  const plain = (await inspectToolcraftImageDownload({ page, download: await downloadImage(page), backgroundRgba: background })).inspection;
  await setSwitch(page, "overlay.export", true);
  await expectToolcraftExportedArtifact(session.targetAction("overlay.export", () => downloadImage(page)), async (download) => {
    const inspected = (await inspectToolcraftImageDownload({ page, download, backgroundRgba: background })).inspection;
    expect(inspected.decodedPixelHash).not.toBe(plain.decodedPixelHash);
    return inspected;
  }, { requirementId: "overlay.export" });
});
