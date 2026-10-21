import { toCss, type RGBA } from "../core/color";
import { boundsOf, inflate, type Point, type Rect } from "../core/geometry";
import { boxShapePath, curveCmds, flattenPath, isBoxShape, pointsToCmds, type PathCmd, type ShapeKind } from "../core/shapes";
import { createEngine } from "./brushes/engines";
import { createCanvas, ctx2d } from "./document";
import type { FillStyle, OutlineStyle } from "./state";

/** Box shapes are drawn in `rect`; line, curve and polygon from `points`. */
export interface ShapeSpec {
  kind: ShapeKind;
  rect: Rect;
  /** line: [a, b]; curve: [a, c1, c2, b]; polygon: its corners. */
  points: Point[];
  /** A polygon still being clicked is drawn open. */
  closed: boolean;
  outline: OutlineStyle;
  fill: FillStyle;
  stroke: RGBA;
  fillColor: RGBA;
  size: number;
}

export function shapeCmds(s: ShapeSpec): PathCmd[] {
  if (isBoxShape(s.kind)) return boxShapePath(s.kind, s.rect);
  if (s.kind === "curve" && s.points.length === 4) return curveCmds(s.points[0], s.points[1], s.points[2], s.points[3]);
  return pointsToCmds(s.points, s.kind === "polygon" && s.closed);
}

export function toPath2D(cmds: readonly PathCmd[]): Path2D {
  const p = new Path2D();
  for (const c of cmds) {
    switch (c.op) {
      case "M": p.moveTo(c.x, c.y); break;
      case "L": p.lineTo(c.x, c.y); break;
      case "C": p.bezierCurveTo(c.x1, c.y1, c.x2, c.y2, c.x, c.y); break;
      case "E": p.moveTo(c.cx + c.rx, c.cy); p.ellipse(c.cx, c.cy, Math.max(0, c.rx), Math.max(0, c.ry), 0, 0, Math.PI * 2); break;
      case "Z": p.closePath(); break;
    }
  }
  return p;
}

/** Area the drawn shape can touch, including the outline width. */
export function shapeBounds(s: ShapeSpec): Rect {
  const base = isBoxShape(s.kind) ? s.rect : boundsOf(s.points);
  return inflate(base, s.size * 2 + 4);
}

/** Draws the shape onto `ctx`. Lines and curves have no fill. */
export function drawShape(ctx: CanvasRenderingContext2D, s: ShapeSpec): void {
  const cmds = shapeCmds(s);
  const path = toPath2D(cmds);
  const fillable = s.kind !== "line" && s.kind !== "curve" && s.closed;
  if (fillable && s.fill === "solid") {
    ctx.fillStyle = toCss(s.fillColor);
    ctx.fill(path, "nonzero");
  }
  if (s.outline === "none" && fillable) return;
  if (s.outline === "solid" || s.outline === "none") {
    ctx.strokeStyle = toCss(s.stroke);
    ctx.lineWidth = s.size;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke(path);
    return;
  }
  drawTexturedOutline(ctx, cmds, s);
}

/** Crayon, marker… outlines: run the brush along the outline on its own layer, then lay it down. */
function drawTexturedOutline(ctx: CanvasRenderingContext2D, cmds: readonly PathCmd[], s: ShapeSpec): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const layer = createCanvas(w, h);
  const lctx = ctx2d(layer);
  const engine = createEngine(s.outline as Exclude<OutlineStyle, "none" | "solid">, w, h, 7);
  const style = { color: s.stroke, size: s.size };
  for (const line of flattenPath(cmds)) {
    engine.begin(lctx, line[0], style);
    for (let i = 1; i < line.length; i++) engine.to(lctx, line[i - 1], line[i], style);
  }
  ctx.save();
  ctx.globalAlpha = engine.opacity;
  ctx.drawImage(layer, 0, 0);
  ctx.restore();
}
