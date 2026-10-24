import { contrastInk } from "./morph-scene";

export type WorkspaceColors = { background: string; dots: string };

const FALLBACK: WorkspaceColors = { background: "#0A0A0A", dots: "#F5F5F5" };
let cache: { key: string; colors: WorkspaceColors } | null = null;

/** Any CSS colour (including oklch from the theme) as #RRGGBB. */
function toHex(color: string, fallback: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) return fallback;
  ctx.fillStyle = fallback;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

/**
 * The editor workspace colours behind the artboard (theme background and the
 * foreground ink used for its dots), so exports can match the preview.
 */
export function workspaceColors(): WorkspaceColors {
  if (typeof document === "undefined" || !document.body) return FALLBACK;
  const root = document.documentElement;
  const key = `${root.className}|${root.getAttribute("data-theme") ?? ""}|${root.style.colorScheme}`;
  if (cache?.key === key) return cache.colors;
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;width:0;height:0;visibility:hidden;background:var(--background);color:var(--foreground)";
  document.body.append(probe);
  const style = getComputedStyle(probe);
  const colors = { background: toHex(style.backgroundColor, FALLBACK.background), dots: toHex(style.color, FALLBACK.dots) };
  probe.remove();
  cache = { key, colors };
  return colors;
}

/** What is visible behind the shape: the background colour, or the workspace when Background is off. */
export function backdropColor(values: Readonly<Record<string, unknown>>, workspace: WorkspaceColors = workspaceColors()): string {
  return values["export.includeBackground"] === false ? workspace.background : String(values["appearance.background"] ?? "#F4F1EA");
}

/** Outline ink that stays visible on the actual backdrop. */
export const outlineInk = (values: Readonly<Record<string, unknown>>) => contrastInk(backdropColor(values));
