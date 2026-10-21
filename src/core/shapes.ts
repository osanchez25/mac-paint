import type { Point, Rect } from "./geometry";

/** The shapes in Windows Paint's Shapes gallery, in the same order. */
export const SHAPE_KINDS = [
  "line",
  "curve",
  "oval",
  "rectangle",
  "roundedRectangle",
  "polygon",
  "triangle",
  "rightTriangle",
  "diamond",
  "pentagon",
  "hexagon",
  "rightArrow",
  "leftArrow",
  "upArrow",
  "downArrow",
  "star4",
  "star5",
  "star6",
  "roundedCallout",
  "ovalCallout",
  "cloudCallout",
  "heart",
  "lightning",
] as const;

export type ShapeKind = (typeof SHAPE_KINDS)[number];

/** Shapes drawn from points the user clicks, not from a dragged box. */
export type PointShape = "line" | "curve" | "polygon";
export type BoxShape = Exclude<ShapeKind, PointShape>;

export function isBoxShape(kind: ShapeKind): kind is BoxShape {
  return kind !== "line" && kind !== "curve" && kind !== "polygon";
}

export const SHAPE_LABELS: Record<ShapeKind, string> = {
  line: "Line",
  curve: "Curve",
  oval: "Oval",
  rectangle: "Rectangle",
  roundedRectangle: "Rounded rectangle",
  polygon: "Polygon",
  triangle: "Triangle",
  rightTriangle: "Right triangle",
  diamond: "Diamond",
  pentagon: "Pentagon",
  hexagon: "Hexagon",
  rightArrow: "Right arrow",
  leftArrow: "Left arrow",
  upArrow: "Up arrow",
  downArrow: "Down arrow",
  star4: "Four-point star",
  star5: "Five-point star",
  star6: "Six-point star",
  roundedCallout: "Rounded rectangular callout",
  ovalCallout: "Oval callout",
  cloudCallout: "Cloud callout",
  heart: "Heart",
  lightning: "Lightning",
};

export type PathCmd =
  | { op: "M"; x: number; y: number }
  | { op: "L"; x: number; y: number }
  | { op: "C"; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { op: "E"; cx: number; cy: number; rx: number; ry: number }
  | { op: "Z" };

type U = readonly (readonly [number, number])[];

const POLYGONS: Partial<Record<BoxShape, U>> = {
  rectangle: [[0, 0], [1, 0], [1, 1], [0, 1]],
  triangle: [[0.5, 0], [1, 1], [0, 1]],
  rightTriangle: [[0, 0], [1, 1], [0, 1]],
  diamond: [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]],
  hexagon: [[0.25, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0.25, 1], [0, 0.5]],
  rightArrow: [[0, 0.25], [0.5, 0.25], [0.5, 0], [1, 0.5], [0.5, 1], [0.5, 0.75], [0, 0.75]],
  leftArrow: [[1, 0.25], [0.5, 0.25], [0.5, 0], [0, 0.5], [0.5, 1], [0.5, 0.75], [1, 0.75]],
  upArrow: [[0.25, 1], [0.25, 0.5], [0, 0.5], [0.5, 0], [1, 0.5], [0.75, 0.5], [0.75, 1]],
  downArrow: [[0.25, 0], [0.25, 0.5], [0, 0.5], [0.5, 1], [1, 0.5], [0.75, 0.5], [0.75, 0]],
  lightning: [
    [0.39, 0], [0.6, 0.27], [0.5, 0.32], [0.77, 0.56], [0.68, 0.6], [1, 1],
    [0.52, 0.68], [0.62, 0.63], [0.27, 0.42], [0.39, 0.36], [0, 0.13],
  ],
};

/** Regular polygon or star vertices, stretched to fill the unit box. */
function radial(points: number, inner: number | null): U {
  const out: [number, number][] = [];
  const count = inner === null ? points : points * 2;
  for (let i = 0; i < count; i++) {
    const r = inner !== null && i % 2 === 1 ? inner : 1;
    const a = -Math.PI / 2 + (i * Math.PI * 2) / count;
    out.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  const xs = out.map((p) => p[0]);
  const ys = out.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(...xs) - minX;
  const h = Math.max(...ys) - minY;
  return out.map(([x, y]) => [(x - minX) / w, (y - minY) / h] as const);
}

const RADIAL: Partial<Record<BoxShape, U>> = {
  pentagon: radial(5, null),
  star4: radial(4, 0.38),
  star5: radial(5, 0.382),
  star6: radial(6, 0.577),
};

function polygonCmds(r: Rect, pts: U): PathCmd[] {
  const cmds: PathCmd[] = pts.map(([u, v], i) => ({ op: i === 0 ? "M" : "L", x: r.x + u * r.w, y: r.y + v * r.h }));
  cmds.push({ op: "Z" });
  return cmds;
}

function roundedRectCmds(r: Rect, radius: number): PathCmd[] {
  const k = 0.5523; // bezier circle constant
  const rad = Math.min(radius, r.w / 2, r.h / 2);
  const { x, y, w, h } = r;
  const c = rad * k;
  return [
    { op: "M", x: x + rad, y },
    { op: "L", x: x + w - rad, y },
    { op: "C", x1: x + w - rad + c, y1: y, x2: x + w, y2: y + rad - c, x: x + w, y: y + rad },
    { op: "L", x: x + w, y: y + h - rad },
    { op: "C", x1: x + w, y1: y + h - rad + c, x2: x + w - rad + c, y2: y + h, x: x + w - rad, y: y + h },
    { op: "L", x: x + rad, y: y + h },
    { op: "C", x1: x + rad - c, y1: y + h, x2: x, y2: y + h - rad + c, x, y: y + h - rad },
    { op: "L", x, y: y + rad },
    { op: "C", x1: x, y1: y + rad - c, x2: x + rad - c, y2: y, x: x + rad, y },
    { op: "Z" },
  ];
}

function heartCmds(r: Rect): PathCmd[] {
  const P = (u: number, v: number) => ({ x: r.x + u * r.w, y: r.y + v * r.h });
  const c = (a: [number, number], b: [number, number], e: [number, number]): PathCmd => {
    const p1 = P(...a);
    const p2 = P(...b);
    const p = P(...e);
    return { op: "C", x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, x: p.x, y: p.y };
  };
  const s = P(0.5, 0.3);
  return [
    { op: "M", ...s },
    c([0.5, 0.12], [0.35, 0], [0.22, 0]),
    c([0.08, 0], [0, 0.12], [0, 0.28]),
    c([0, 0.55], [0.3, 0.75], [0.5, 1]),
    c([0.7, 0.75], [1, 0.55], [1, 0.28]),
    c([1, 0.12], [0.92, 0], [0.78, 0]),
    c([0.65, 0], [0.5, 0.12], [0.5, 0.3]),
    { op: "Z" },
  ];
}

/** Callout body with a tail toward the bottom left, as one outline. */
function calloutCmds(r: Rect, oval: boolean): PathCmd[] {
  const bodyH = r.h * 0.78;
  const body: Rect = { x: r.x, y: r.y, w: r.w, h: bodyH };
  const tip = { x: r.x + r.w * 0.12, y: r.y + r.h };
  const pts: Point[] = [];
  if (oval) {
    const cx = body.x + body.w / 2;
    const cy = body.y + body.h / 2;
    const steps = 96;
    // Start the outline just right of the tail so the tail closes the loop.
    const a0 = Math.PI * 0.58;
    const a1 = Math.PI * 0.72;
    for (let i = 0; i <= steps; i++) {
      const a = a0 - (i / steps) * (Math.PI * 2 - (a1 - a0));
      pts.push({ x: cx + Math.cos(a) * (body.w / 2), y: cy + Math.sin(a) * (body.h / 2) });
    }
    pts.push(tip);
    return pointsToCmds(pts, true);
  }
  const rad = Math.min(body.w, body.h) * 0.18;
  const tailL = body.x + body.w * 0.18;
  const tailR = body.x + body.w * 0.36;
  const base = roundedRectCmds(body, rad);
  // Splice the tail into the bottom edge: index 5 is the "L" toward the bottom-left corner.
  const bottomIdx = 5;
  const out = base.slice(0, bottomIdx);
  out.push({ op: "L", x: tailR, y: body.y + body.h }, { op: "L", x: tip.x, y: tip.y }, { op: "L", x: tailL, y: body.y + body.h });
  return out.concat(base.slice(bottomIdx));
}

function cloudCmds(r: Rect): PathCmd[] {
  const body: Rect = { x: r.x + r.w * 0.08, y: r.y, w: r.w * 0.92, h: r.h * 0.74 };
  const cx = body.x + body.w / 2;
  const cy = body.y + body.h / 2;
  const pts: Point[] = [];
  const steps = 240;
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const bump = 0.86 + 0.14 * Math.abs(Math.sin(t * 5));
    pts.push({ x: cx + Math.cos(t) * (body.w / 2) * bump, y: cy + Math.sin(t) * (body.h / 2) * bump });
  }
  const cmds = pointsToCmds(pts, true);
  // Thought bubbles trailing toward the bottom left.
  const bubbles = [
    { u: 0.2, v: 0.82, s: 0.07 },
    { u: 0.1, v: 0.92, s: 0.045 },
    { u: 0.03, v: 0.97, s: 0.025 },
  ];
  for (const b of bubbles) {
    cmds.push({ op: "E", cx: r.x + b.u * r.w, cy: r.y + b.v * r.h, rx: b.s * r.w, ry: b.s * r.h });
  }
  return cmds;
}

export function pointsToCmds(points: readonly Point[], close: boolean): PathCmd[] {
  const cmds: PathCmd[] = points.map((p, i) => ({ op: i === 0 ? "M" : "L", x: p.x, y: p.y }));
  if (close) cmds.push({ op: "Z" });
  return cmds;
}

/** Outline of a box shape drawn inside `r`. */
export function boxShapePath(kind: BoxShape, r: Rect): PathCmd[] {
  const poly = POLYGONS[kind] ?? RADIAL[kind];
  if (poly) return polygonCmds(r, poly);
  switch (kind) {
    case "oval":
      return [{ op: "E", cx: r.x + r.w / 2, cy: r.y + r.h / 2, rx: r.w / 2, ry: r.h / 2 }];
    case "roundedRectangle":
      return roundedRectCmds(r, Math.min(r.w, r.h) * 0.2);
    case "roundedCallout":
      return calloutCmds(r, false);
    case "ovalCallout":
      return calloutCmds(r, true);
    case "cloudCallout":
      return cloudCmds(r);
    case "heart":
      return heartCmds(r);
    default:
      throw new Error(`no outline for shape "${kind}"`);
  }
}

/** A cubic curve from a to b bent by two control points (Paint's Curve tool). */
export function curveCmds(a: Point, c1: Point, c2: Point, b: Point): PathCmd[] {
  return [
    { op: "M", x: a.x, y: a.y },
    { op: "C", x1: c1.x, y1: c1.y, x2: c2.x, y2: c2.y, x: b.x, y: b.y },
  ];
}

/** Turns a path into polylines (one per subpath), for brush-textured outlines. */
export function flattenPath(cmds: readonly PathCmd[], segmentsPerCurve = 24): Point[][] {
  const out: Point[][] = [];
  let cur: Point[] = [];
  let start: Point | null = null;
  let last: Point = { x: 0, y: 0 };
  for (const c of cmds) {
    if (c.op === "M") {
      if (cur.length > 1) out.push(cur);
      start = { x: c.x, y: c.y };
      last = start;
      cur = [start];
    } else if (c.op === "L") {
      last = { x: c.x, y: c.y };
      cur.push(last);
    } else if (c.op === "C") {
      for (let i = 1; i <= segmentsPerCurve; i++) {
        const t = i / segmentsPerCurve;
        const mt = 1 - t;
        last = {
          x: mt * mt * mt * last.x + 3 * mt * mt * t * c.x1 + 3 * mt * t * t * c.x2 + t * t * t * c.x,
          y: mt * mt * mt * last.y + 3 * mt * mt * t * c.y1 + 3 * mt * t * t * c.y2 + t * t * t * c.y,
        };
        cur.push(last);
      }
      last = { x: c.x, y: c.y };
    } else if (c.op === "E") {
      if (cur.length > 1) out.push(cur);
      const n = Math.max(32, Math.ceil(Math.max(c.rx, c.ry)));
      const ring: Point[] = [];
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        ring.push({ x: c.cx + Math.cos(a) * c.rx, y: c.cy + Math.sin(a) * c.ry });
      }
      out.push(ring);
      cur = [];
      start = null;
    } else if (c.op === "Z" && start) {
      cur.push(start);
      out.push(cur);
      cur = [];
      last = start;
    }
  }
  if (cur.length > 1) out.push(cur);
  return out;
}
