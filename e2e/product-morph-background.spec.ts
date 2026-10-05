import { expectToolcraftReferenceParity } from "./browser-acceptance-outcome-helpers";
import { expectToolcraftBackgroundOutputSemantics, expectToolcraftFiniteBackgroundMediaStacking } from "./browser-background-output-evidence";
import { expectToolcraftInfinityCanvasBackgroundEvidence, observeInfinityCanvasBackground } from "./browser-infinity-canvas-evidence";
import { inspectToolcraftImageDownload } from "./image-artifact-inspection";
import { expectToolcraftProductObservableToChange } from "./product-observable-helpers";
import { expect, test } from "./toolcraft-product-test";
import { inspectToolcraftVideoDownload } from "./video-artifact-inspection";
import { downloadImage, downloadVideo, editDuration, field, openMorph, selectOption, setColor } from "./morph-test-helpers";

const BACKGROUND = "#F4F1EA";

test("browser: morph background color changes output", async ({ page }) => {
  const session = await openMorph(page);
  await expectToolcraftProductObservableToChange(
    session, session.controlAction("appearance.background", () => setColor(page, "appearance.background", "#123456")),
    { requirementId: "appearance.background", selector: "[data-toolcraft-editable-canvas]" },
  );
  await expectToolcraftReferenceParity(async () => (await field(page, "appearance.background")).getByRole("textbox").inputValue(), "#123456",
    { requirementId: "appearance.background", target: "appearance.background" });
});

test("browser: morph background output follows runtime semantics", async ({ page }) => {
  const session = await openMorph(page);
  await editDuration(page, 1);
  await selectOption(page, "export.image.resolution", "2K");
  const infinity = page.getByRole("switch", { name: "Infinity canvas", exact: true });
  if (await infinity.isChecked()) await infinity.uncheck();

  const observe = session.observe((root) => {
    const background = root.querySelector<HTMLElement>("[data-toolcraft-finite-background-layer]");
    return { backgroundVisible: background !== null, outputSignature: background ? getComputedStyle(background).backgroundColor : "transparent" };
  });
  await expectToolcraftBackgroundOutputSemantics(
    observe,
    session.controlAction("export.includeBackground", async (control) => control.getByRole("switch").uncheck()),
    { backgroundVisible: false, outputSignature: "transparent" },
    session.targetAction("actions.output", () => downloadImage(page)),
    async (download) => {
      const result = await inspectToolcraftImageDownload({ download, page, backgroundRgba: [0, 0, 0, 0] });
      return { ...result.inspection, backgroundAlpha: result.observation.normalizedPixels[3] };
    },
    {
      requirementId: "background.output",
      video: {
        exportArtifact: session.targetAction("actions.output", () => downloadVideo(page)),
        inspectArtifact: async (download) => {
          const schedule = Array.from({ length: 30 }, (_, index) => ({ index, timeSeconds: index / 30, durationSeconds: 1 / 30 }));
          const inspected = await inspectToolcraftVideoDownload({ download, page, backgroundRgba: [244, 241, 234, 255], schedule });
          const corner = inspected.observations[0]!.normalizedPixels.slice(0, 3);
          return { ...inspected.inspection, backgroundIncluded: corner.every((v, i) => Math.abs(v - [244, 241, 234][i]!) <= 6) };
        },
      },
    },
  );

  // Background → product: the runtime layer sits under the transparent SVG foreground.
  const stacking = session.observe((root) => {
    const background = root.querySelector<HTMLElement>("[data-toolcraft-finite-background-layer]");
    const product = root.querySelector<HTMLElement>("[data-toolcraft-product-scene]");
    const svg = root.querySelector<SVGElement>('[data-testid="morph-output"]');
    const order: string[] = [];
    if (background && product) order.push(...(background.compareDocumentPosition(product) & Node.DOCUMENT_POSITION_FOLLOWING ? ["background", "product"] : ["product", "background"]));
    else if (product) order.push("product");
    return {
      backgroundColor: background ? getComputedStyle(background).backgroundColor : "",
      backgroundVisible: background !== null,
      canvasMode: root.querySelector('[role="switch"][aria-label="Infinity canvas"][aria-checked="true"]') ? "infinite" as const : "finite" as const,
      layerOrder: order,
      mediaVisible: false,
      outputSignature: `${background ? getComputedStyle(background).backgroundColor : "none"}|${svg?.querySelector('[data-testid="morph-shape"]')?.getAttribute("d")?.length ?? 0}`,
      productForegroundTransparent: svg ? getComputedStyle(svg).backgroundColor === "rgba(0, 0, 0, 0)" : false,
    };
  });
  const expectedColor = await page.evaluate((hex) => {
    const probe = document.createElement("div");
    probe.style.backgroundColor = hex;
    document.body.append(probe);
    const value = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return value;
  }, BACKGROUND);
  const shapeLength = (await page.locator('[data-testid="morph-shape"]').getAttribute("d"))!.length;
  await expectToolcraftFiniteBackgroundMediaStacking(stacking, session.controlAction("export.includeBackground", async (control) => control.getByRole("switch").check()), {
    backgroundColor: expectedColor, backgroundVisible: true, canvasMode: "finite", layerOrder: ["background", "product"], mediaVisible: false,
    outputSignature: `${expectedColor}|${shapeLength}`, productForegroundTransparent: true,
  }, { requirementId: "background.output" });

  await infinity.check();
  const infinite = await observeInfinityCanvasBackground(page);
  await page.getByRole("switch", { name: "Background", exact: true }).uncheck();
  const backgroundExcluded = await observeInfinityCanvasBackground(page);
  await page.getByRole("switch", { name: "Background", exact: true }).check();
  const backgroundRestored = await observeInfinityCanvasBackground(page);
  await expectToolcraftInfinityCanvasBackgroundEvidence({ infinite, backgroundExcluded, backgroundRestored }, {
    requirementId: "background.output", target: "export.includeBackground", expectedBackgroundColor: BACKGROUND,
  });
  await expect(infinity).toBeChecked();
});
