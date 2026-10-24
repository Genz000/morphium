/** One cubic segment: start, control 1, control 2, end. */
export type CubicSegment = [number, number, number, number, number, number, number, number];

export type Subpath = { closed: boolean; segs: CubicSegment[]; ghost?: boolean };

export type Matrix = readonly [number, number, number, number, number, number];

export type ViewBox = readonly [number, number, number, number];

/** A parsed SVG frame in its own file coordinates. */
export type MorphFrame = { name: string; subs: Subpath[]; viewBox: ViewBox };

export type FitMode = "viewbox" | "content";

export type SequenceMode = "loop" | "pingpong" | "once";

export type CoordinateLabels = "off" | "anchors" | "handles" | "both";

export type LineJoin = "miter" | "round" | "bevel";
