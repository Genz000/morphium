"use client";

import { CanvasDotPattern } from "@/toolcraft/ui";
import { toolcraftCanvasWorkspaceBackgroundTarget } from "../../schema/runtime-targets";
import { useToolcraftValue } from "../app-shell/use-toolcraft";
import { useCanvasViewportTransform } from "./canvas-viewport-world";

/** Morphium: the dot grid follows the artwork Scale control (frames.scale, %) as well as canvas zoom. */
const ARTWORK_SCALE_TARGET = "frames.scale";

function WorkspaceDots({ color }: { color?: string }): React.JSX.Element {
  const { offsetX, offsetY, zoom } = useCanvasViewportTransform();
  const artworkScale = Number(useToolcraftValue(ARTWORK_SCALE_TARGET) ?? 100);
  const scale = (zoom / 100) * (Number.isFinite(artworkScale) && artworkScale > 0 ? artworkScale / 100 : 1);
  return <CanvasDotPattern color={color} offset={{ x: offsetX, y: offsetY }} scale={scale} />;
}

export function CanvasWorkspaceBackground(): React.JSX.Element | null {
  const mode = useToolcraftValue(toolcraftCanvasWorkspaceBackgroundTarget);
  return mode === "dots" ? <WorkspaceDots /> : null;
}
