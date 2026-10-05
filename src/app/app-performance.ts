import { defineToolcraftPerformance, deriveToolcraftPerformancePaths, type ToolcraftPerformanceScenario } from "@/toolcraft/runtime";

import { morphPerformanceModel } from "../morph/morph-performance-model";
import { appSchema } from "./app-schema";

export const morphPerformancePaths = deriveToolcraftPerformancePaths(appSchema, morphPerformanceModel);

export const appPerformance = defineToolcraftPerformance({
  ...morphPerformanceModel,
  scenarios: morphPerformancePaths.map((path, index): ToolcraftPerformanceScenario => ({
    id: `morph-path-${index}`, pathId: path.id, coversTargets: path.targets, interaction: path.interaction,
    automated: true, automatedTestName: "morph render plan has valid derived paths and fixtures",
    browser: true, browserTestName: `browser perf: toolcraft path ${path.id}`,
    expectedObservable: "The morph preview, viewport or decoded artifact reflects the exact applied operation.",
    fixture: "Compiled reachable morph workload", uiSelector: '[data-testid="morph-output"]',
    ...(path.interaction === "export" ? { actionValue: "export.png", controlLabel: "Export PNG", completionEvidence: "download" as const } : {}),
  } as ToolcraftPerformanceScenario)),
});
