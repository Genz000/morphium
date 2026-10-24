import { memo } from "react";

import type { MorphSettings } from "./morph-settings";
import {
  formatCoordinate, overlayGeometry, showsAnchorLabels, showsHandleLabels, type StageMap,
} from "./morph-scene";
import type { Subpath } from "./morph-types";

type Props = { shape: readonly Subpath[]; map: StageMap; settings: MorphSettings; ui: number; anchorOpacity?: number; handleOpacity?: number };

/** Anchors, bézier handles and coordinate labels drawn over the shape, in scene pixels. */
export const MorphOverlays = memo(function MorphOverlays({ shape, map, settings, ui, anchorOpacity = 1, handleOpacity = 1 }: Props) {
  const X = (x: number) => x * map.s + map.ox, Y = (y: number) => y * map.s + map.oy;
  const { anchors, handles } = overlayGeometry(shape, 0.5 / map.s);
  const ps = settings.pointSize * ui;
  const fs = settings.labelSize * ui;
  const label = (x: number, y: number, color: string, key: string) => {
    const text = `${formatCoordinate(x, settings.decimals)}, ${formatCoordinate(y, settings.decimals)}`;
    const padX = 4 * ui, h = fs + 5 * ui, w = text.length * fs * 0.6 + padX * 2;
    const lx = X(x) + ps + 4 * ui, ly = Y(y) - ps - h / 2 - 2 * ui;
    return (
      <g key={key}>
        <rect x={lx} y={ly - h / 2} width={w} height={h} rx={3 * ui} fill="rgba(14,15,17,0.86)" />
        <text
          data-toolcraft-product-text="" x={lx + padX} y={ly + 0.5 * ui} fill={color} fontSize={fs}
          fontFamily='"JetBrains Mono", ui-monospace, monospace' fontWeight={500} dominantBaseline="middle"
        >{text}</text>
      </g>
    );
  };
  return (
    <g data-testid="morph-overlays">
      {settings.handles && handleOpacity > 0 ? (
        <g data-testid="morph-handles" opacity={handleOpacity}>
          <path
            d={handles.map((h) => `M${X(h[0])} ${Y(h[1])}L${X(h[2])} ${Y(h[3])}`).join("")}
            stroke={settings.handleColor} strokeOpacity={0.75} strokeWidth={ui} fill="none"
          />
          {handles.map((h, i) => <circle key={i} cx={X(h[2])} cy={Y(h[3])} r={ps * 0.75} fill={settings.handleColor} />)}
        </g>
      ) : null}
      {settings.anchors && anchorOpacity > 0 ? (
        <g data-testid="morph-anchors" opacity={anchorOpacity}>
          {anchors.map(([ax, ay], i) => (
            <rect
              key={i} x={X(ax) - ps} y={Y(ay) - ps} width={ps * 2} height={ps * 2}
              fill="#FFFFFF" stroke={settings.anchorColor} strokeWidth={1.5 * ui}
            />
          ))}
        </g>
      ) : null}
      {showsHandleLabels(settings) && handleOpacity > 0 ? (
        <g data-testid="morph-handle-labels" opacity={handleOpacity}>{handles.map((h, i) => label(h[2], h[3], settings.handleColor, `h${i}`))}</g>
      ) : null}
      {showsAnchorLabels(settings) && anchorOpacity > 0 ? (
        <g data-testid="morph-anchor-labels" opacity={anchorOpacity}>{anchors.map(([ax, ay], i) => label(ax, ay, "#FFFFFF", `a${i}`))}</g>
      ) : null}
    </g>
  );
});
