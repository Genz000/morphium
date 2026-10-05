import { describe, expect, it } from "vitest";

import {
  assessToolcraftRenderPlan, compileToolcraftPerformanceFixturePlan, createToolcraftState, getToolcraftFiniteArtboardRect,
  toolcraftReducer, type ToolcraftMediaAsset,
} from "@/toolcraft/runtime";

import { appAcceptance } from "../app/app-acceptance-data";
import { appPerformance, morphPerformancePaths } from "../app/app-performance";
import { appSchema } from "../app/app-schema";
import { EASING_PRESETS, resolveEasing } from "./morph-easing";
import { morphExport } from "./morph-export";
import { cachedFrames, decodeFrames, frameAssets, MAX_SEGMENTS_PER_FRAME, parseFrameText } from "./morph-frames";
import { DEMO_FRAMES } from "./morph-default-assets";
import { parseSvgFrame } from "./morph-svg";
import { lerpShape, normalizeFrames, subdivide } from "./morph-normalize";
import { arcToCubics, parsePathData, pathToSubpaths } from "./morph-path";
import { keyOrder, phaseAt } from "./morph-sequence";
import { FRAMES_TARGET, morphDefaults, readMorphSettings } from "./morph-settings";
import { drawMorphFrame } from "./morph-draw";
import { formatCoordinate, overlayGeometry, shapeAtProgress, stageMap } from "./morph-scene";
import { demoFrames, drawSignature, FRAME, MID_MORPH, recordingContext } from "./morph-test-support";

/** Values that make each control's effect visible at the mid-morph fixture. */
const changes: Record<string, { base?: Record<string, unknown>; value: unknown }> = {
  "frames.fit": { value: "content" },
  "motion.sequence": { value: "pingpong" },
  "motion.delay": { value: 1500 },
  "motion.duration": { value: 400 },
  "motion.easing": { value: "linear" },
  "motion.curve": { base: { "motion.easing": "custom" }, value: { activeChannel: "RGB", points: { RGB: [{ x: 0, y: 0 }, { x: 0.5, y: 0.9 }, { x: 1, y: 1 }] } } },
  "shape.outline": { value: true },
  "shape.fillOn": { value: false },
  "shape.fill": { value: "#2255FF" },
  "shape.stroke": { base: { "shape.strokeWidth": 6 }, value: "#00AA44" },
  "shape.strokeWidth": { value: 8 },
  "shape.lineJoin": { base: { "shape.strokeWidth": 12 }, value: "bevel" },
  "overlay.anchors": { value: false },
  "overlay.anchorColor": { value: "#AA00FF" },
  "overlay.handles": { value: false },
  "overlay.handleColor": { value: "#FFAA00" },
  "overlay.pointSize": { value: 9 },
  "overlay.labels": { value: "both" },
  "overlay.decimals": { base: { "overlay.labels": "anchors" }, value: "2" },
  "overlay.labelSize": { base: { "overlay.labels": "anchors" }, value: 16 },
  "overlay.export": { base: { "overlay.export": false }, value: true },
};

for (const row of appAcceptance.filter((r) => r.automatedTestName.startsWith("morph parameter"))) {
  it(row.automatedTestName, () => {
    const change = changes[row.target!];
    expect(change, `fixture for ${row.target}`).toBeDefined();
    const base = change.base ?? {};
    expect(drawSignature({ ...base, [row.target!]: change.value })).not.toBe(drawSignature(base));
  });
}

const asset = (id: string, sourceTarget = FRAMES_TARGET, lifecycle = "ready") =>
  ({ assetKind: "file", id, fileName: `${id}.svg`, layerId: id, mimeType: "image/svg+xml", sourceTarget, lifecycle, resourceRef: `ref-${id}`, position: { x: 0, y: 0 } }) as unknown as ToolcraftMediaAsset;

async function primeCache(names: readonly string[]) {
  const assets = frameAssets(names.map((n) => asset(n)));
  const urls = new Map(assets.map((a) => [a.id, `blob:${a.id}`]));
  const byName = new Map(demoFrames.map((f) => [f.name, f]));
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => ({ ok: true, text: async () => "" })) as unknown as typeof fetch;
  try {
    await decodeFrames(assets, urls, (_text, fileName) => byName.get(fileName)!);
  } finally { globalThis.fetch = realFetch; }
  return assets;
}

async function exportSignature(values: Record<string, unknown>, timelineProgress: number, frame = FRAME) {
  const state = toolcraftReducer(createToolcraftState(appSchema), { type: "controls.setValue", target: "motion.delay", value: values["motion.delay"] ?? 500 });
  const mediaAssets = ["circle", "star", "blob", "ring"].map((n) => asset(n));
  const { context, calls } = recordingContext();
  await morphExport.renderFrame({
    context, frame, pixelRatio: 1, rendererPipeline: null, signal: new AbortController().signal, timeSeconds: 0, timelineProgress,
    state: { ...state, mediaAssets, values: { ...state.values, ...values } } as never,
  });
  return JSON.stringify(calls);
}

const contractTests: Record<string, () => void | Promise<void>> = {
  "frames.source": async () => {
    const ordered = frameAssets([asset("b"), asset("x", "other"), asset("a"), asset("r", FRAMES_TARGET, "restoring"), asset("c"), asset("d"), asset("e"), asset("f")]);
    expect(ordered.map((a) => a.id)).toEqual(["b", "a", "c", "d", "e"]);
    const assets = await primeCache(["circle.svg", "star.svg"].map((n) => n.replace(".svg", "")));
    expect(cachedFrames(assets)?.map((f) => f.name)).toEqual(["circle.svg", "star.svg"]);
    expect(drawSignature({}, { frames: [demoFrames[1], demoFrames[0]] })).not.toBe(drawSignature({}));
  },
  "appearance.background": () => {
    expect(drawSignature({ "shape.outline": true, "appearance.background": "#101010" })).not.toBe(drawSignature({ "shape.outline": true }));
  },
  "background.output": () => {
    // Runtime owns the background fill; product frames must stay a transparent foreground.
    const { context, calls } = recordingContext();
    const settings = readMorphSettings({ "appearance.background": "#ABCDEF" });
    const { shape } = shapeAtProgress(normalizeFrames(demoFrames, "viewbox"), MID_MORPH, settings);
    drawMorphFrame(context, shape, stageMap(demoFrames[0].viewBox, FRAME), settings, "#ABCDEF", 1.8, false);
    expect(calls.some((c) => (c as unknown[])[0] === "fillRect")).toBe(false);
    expect(calls.some((c) => (c as unknown[])[1] === "#ABCDEF")).toBe(false);
    expect(calls.some((c) => (c as unknown[])[0] === "fill")).toBe(true);
  },
  "export.image.format": async () => { await primeCache(["circle", "star", "blob", "ring"]); expect(await exportSignature({}, MID_MORPH)).not.toBe("[]"); },
  "export.image.resolution": async () => {
    await primeCache(["circle", "star", "blob", "ring"]);
    expect(await exportSignature({}, MID_MORPH, { x: 0, y: 0, width: 4096, height: 2304 })).not.toBe(await exportSignature({}, MID_MORPH));
  },
  "export.video.format": async () => { await primeCache(["circle", "star", "blob", "ring"]); expect(await exportSignature({}, 0.4)).not.toBe(await exportSignature({}, 0.6)); },
  "export.video.resolution": async () => {
    await primeCache(["circle", "star", "blob", "ring"]);
    expect(await exportSignature({}, 0.4, { x: 0, y: 0, width: 3840, height: 2160 })).not.toBe(await exportSignature({}, 0.4));
  },
  "export.image": async () => { await primeCache(["circle", "star", "blob", "ring"]); expect(await exportSignature({ "overlay.export": true }, MID_MORPH)).not.toBe(await exportSignature({}, MID_MORPH)); },
  "export.actions": async () => { await primeCache(["circle", "star", "blob", "ring"]); expect(await exportSignature({}, 0.1)).not.toBe(await exportSignature({}, 0.3)); },
  "export.video": async () => {
    await primeCache(["circle", "star", "blob", "ring"]);
    expect(await exportSignature({}, 0)).toBe(await exportSignature({}, 1));
    expect(await exportSignature({}, 0.5)).not.toBe(await exportSignature({}, 0));
  },
  "timeline.playback": () => {
    const ease = resolveEasing("linear", undefined);
    expect(keyOrder(4, "loop")).toEqual([0, 1, 2, 3, 0]);
    expect(keyOrder(4, "pingpong")).toEqual([0, 1, 2, 3, 2, 1, 0]);
    expect(phaseAt(0, 4, "loop", 30, ease)).toMatchObject({ a: 0, holding: true });
    const end = phaseAt(1, 4, "loop", 30, ease);
    expect(end.b).toBe(0); expect(end.p).toBe(1);
    expect(drawSignature({}, { progress: 0 })).toBe(drawSignature({}, { progress: 1 }));
  },
  "canvas.size": () => {
    expect(drawSignature({}, { frame: { x: -640, y: -360, width: 1280, height: 720 } })).not.toBe(drawSignature({}));
    expect(stageMap([0, 0, 400, 400], FRAME).s).toBe(1080 / 400);
  },
  "canvas.infinity": () => {
    const state = createToolcraftState(appSchema);
    const changed = toolcraftReducer(state, { type: "controls.setValue", target: "canvas.infinity", value: true });
    expect(changed.canvas.size).toEqual(state.canvas.size);
    expect(getToolcraftFiniteArtboardRect(changed.canvas.size)).toEqual({ x: -960, y: -540, width: 1920, height: 1080 });
  },
  "persistence.reload": () => {
    expect(appSchema.persistence.storage).toBe("localStorage");
    const values = { "motion.delay": 900, "shape.fill": "#123456", "overlay.labels": "both" };
    expect(drawSignature(JSON.parse(JSON.stringify(values)))).toBe(drawSignature(values));
  },
};

for (const row of appAcceptance.filter((r) => r.automatedTestName.startsWith("morph contract"))) {
  it(row.automatedTestName, async () => {
    const test = contractTests[row.id];
    expect(test, `contract test for ${row.id}`).toBeDefined();
    await test();
  });
}

it("morph render plan has valid derived paths and fixtures", () => {
  expect(assessToolcraftRenderPlan(appSchema, appPerformance).errors).toEqual([]);
  for (const path of morphPerformancePaths) {
    if (path.workloadDimensions.length) {
      expect(compileToolcraftPerformanceFixturePlan(appPerformance, path).dimensionIds).toEqual(path.workloadDimensions);
    }
  }
});

describe("morph engine (ported from the original page)", () => {
  it("parses compact arc flags and relative commands", () => {
    expect(parsePathData("a1 1 0 011 1")).toEqual([{ c: "a", a: [1, 1, 0, 0, 1, 1, 1] }]);
    const subs = pathToSubpaths("m10 10h30v30h-30z");
    expect(subs).toHaveLength(1);
    expect(subs[0].closed).toBe(true);
    expect(subs[0].segs.map((g) => [g[6], g[7]])).toEqual([[40, 10], [40, 40], [10, 40], [10, 10]]);
  });
  it("splits a half circle arc into quarter cubics", () => {
    expect(arcToCubics(0, 0, 10, 10, 0, 0, 1, 20, 0)).toHaveLength(2);
  });
  it("gives every frame the same structure and keeps the hole as a ghost elsewhere", () => {
    const norm = normalizeFrames(demoFrames, "viewbox");
    const shape = norm.map((f) => f.map((s) => s.segs.length).join("/"));
    expect(new Set(shape).size).toBe(1);
    expect(norm[0][1].ghost).toBe(true);
    expect(norm[3][1].ghost).toBeFalsy();
  });
  it("subdivides by length to the exact count", () => {
    const sub = { closed: true, segs: pathToSubpaths("M0 0H100V10H0Z")[0].segs };
    subdivide(sub, 11);
    expect(sub.segs).toHaveLength(11);
  });
  it("interpolates endpoints exactly", () => {
    const norm = normalizeFrames(demoFrames, "viewbox");
    expect(lerpShape(norm[0], norm[1], 0)[0].segs).toEqual(norm[0][0].segs);
    expect(lerpShape(norm[0], norm[1], 1)[0].segs).toEqual(norm[1][0].segs);
  });
  it("hides handles on straight segments and formats coordinates", () => {
    const square = pathToSubpaths("M0 0H10V10H0Z");
    expect(overlayGeometry(square).handles).toHaveLength(0);
    expect(overlayGeometry(square).anchors).toHaveLength(4);
    expect(formatCoordinate(-0.04, 1)).toBe("0.0");
    expect(formatCoordinate(12.345, 2)).toBe("12.35");
  });
  it("keeps every preset easing anchored at 0 and 1", () => {
    for (const preset of Object.values(EASING_PRESETS)) {
      expect(preset.fn(0)).toBeCloseTo(0, 5);
      expect(preset.fn(1)).toBeCloseTo(1, 5);
    }
    expect(resolveEasing("custom", morphDefaults.curve)(0.5)).toBeCloseTo(0.5, 1);
  });
  it("enforces the per-frame segment limit", () => {
    const many = Array.from({ length: 4001 }, (_, i) => `L${i} ${i % 7}`).join("");
    expect(() => parseFrameText(`<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0${many}"/></svg>`, "big.svg")).toThrow(/limit is 4000/);
    expect(MAX_SEGMENTS_PER_FRAME).toBe(4000);
  });
  it("parses the demo files, groups, transforms and <use>", () => {
    expect(DEMO_FRAMES.map(([name, svg]) => parseSvgFrame(svg, name).subs.length)).toEqual([1, 1, 1, 2]);
    const frame = parseSvgFrame(`<?xml version="1.0"?><!-- c --><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="200" height="100">
      <defs><circle id="c" cx="150" cy="50" r="10"/></defs>
      <g transform="translate(10 10)"><rect width="20" height="20"/><polygon points="0,0 20,0 10,20"/></g>
      <use xlink:href="#c" x="5"/><text>ignored</text><path d="M0 0" style="display:none"/></svg>`, "mixed.svg");
    expect(frame.viewBox).toEqual([0, 0, 200, 100]);
    expect(frame.subs).toHaveLength(3);
    expect(frame.subs[0].segs[0].slice(0, 2)).toEqual([10, 10]);
    expect(Math.max(...frame.subs[2].segs.map((g) => g[0]))).toBeCloseTo(165);
    expect(() => parseSvgFrame("<html></html>", "x.svg")).toThrow(/not a valid SVG/);
  });
});
