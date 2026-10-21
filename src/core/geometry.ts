export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Rect spanned by two corner points, with positive width and height. */
export function rectFromPoints(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y),
  };
}

/** Snaps whole-pixel bounds that fully contain `r`. */
export function pixelBounds(r: Rect): Rect {
  const x = Math.floor(r.x);
  const y = Math.floor(r.y);
  return { x, y, w: Math.ceil(r.x + r.w) - x, h: Math.ceil(r.y + r.h) - y };
}

export function intersect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const r = Math.min(a.x + a.w, b.x + b.w);
  const btm = Math.min(a.y + a.h, b.y + b.h);
  if (r <= x || btm <= y) return null;
  return { x, y, w: r - x, h: btm - y };
}

export function union(a: Rect | null, b: Rect): Rect {
  if (!a) return { ...b };
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.y + a.h, b.y + b.h) - y,
  };
}

export function inflate(r: Rect, by: number): Rect {
  return { x: r.x - by, y: r.y - by, w: r.w + by * 2, h: r.h + by * 2 };
}

export function contains(r: Rect, p: Point): boolean {
  return p.x >= r.x && p.y >= r.y && p.x <= r.x + r.w && p.y <= r.y + r.h;
}

export function boundsOf(points: readonly Point[]): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Shift-drag on a line: snap the end point to the nearest 45° direction. */
export function snapAngle45(from: Point, to: Point): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return { ...to };
  const step = Math.PI / 4;
  const angle = Math.round(Math.atan2(dy, dx) / step) * step;
  // Diagonals keep the drag's larger axis so the end lands on whole pixels.
  if (Math.abs(Math.cos(angle)) > 0.01 && Math.abs(Math.sin(angle)) > 0.01) {
    const d = Math.max(Math.abs(dx), Math.abs(dy));
    return { x: from.x + Math.sign(Math.cos(angle)) * d, y: from.y + Math.sign(Math.sin(angle)) * d };
  }
  // Horizontal or vertical: keep the drag's distance along that axis.
  return Math.abs(Math.cos(angle)) > 0.5 ? { x: to.x, y: from.y } : { x: from.x, y: to.y };
}

/** Shift-drag on a box: make it square, keeping the drag direction. */
export function squareFrom(anchor: Point, to: Point): Point {
  const dx = to.x - anchor.x;
  const dy = to.y - anchor.y;
  const d = Math.max(Math.abs(dx), Math.abs(dy));
  return { x: anchor.x + (dx < 0 ? -d : d), y: anchor.y + (dy < 0 ? -d : d) };
}

/** Integer points of a straight line (Bresenham), both ends included. */
export function linePixels(a: Point, b: Point): Point[] {
  let x0 = Math.round(a.x);
  let y0 = Math.round(a.y);
  const x1 = Math.round(b.x);
  const y1 = Math.round(b.y);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  const out: Point[] = [];
  for (;;) {
    out.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
  return out;
}

/** Points every `spacing` px from a to b (excluding a), for stamping brushes. */
export function stepsBetween(a: Point, b: Point, spacing: number): Point[] {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.max(1, Math.ceil(len / Math.max(0.5, spacing)));
  const out: Point[] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return out;
}

/** Even-odd point-in-polygon test, for free-form selections. */
export function pointInPolygon(p: Point, poly: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

export type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export const HANDLES: readonly Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

export function handlePoint(r: Rect, h: Handle): Point {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const right = r.x + r.w;
  const bottom = r.y + r.h;
  switch (h) {
    case "nw": return { x: r.x, y: r.y };
    case "n": return { x: cx, y: r.y };
    case "ne": return { x: right, y: r.y };
    case "e": return { x: right, y: cy };
    case "se": return { x: right, y: bottom };
    case "s": return { x: cx, y: bottom };
    case "sw": return { x: r.x, y: bottom };
    case "w": return { x: r.x, y: cy };
  }
}

/** The handle within `tolerance` of `p`, if any. */
export function hitHandle(r: Rect, p: Point, tolerance: number): Handle | null {
  for (const h of HANDLES) {
    const hp = handlePoint(r, h);
    if (Math.abs(hp.x - p.x) <= tolerance && Math.abs(hp.y - p.y) <= tolerance) return h;
  }
  return null;
}

/** New rect after dragging handle `h` of `start` by (dx, dy). Width/height may go negative and flip. */
export function dragHandle(start: Rect, h: Handle, dx: number, dy: number, keepRatio: boolean): Rect {
  let { x, y, w, h: hh } = start;
  if (h.includes("w")) {
    x += dx;
    w -= dx;
  }
  if (h.includes("e")) w += dx;
  if (h.includes("n")) {
    y += dy;
    hh -= dy;
  }
  if (h.includes("s")) hh += dy;
  if (keepRatio && start.w !== 0 && start.h !== 0 && h.length === 2) {
    const ratio = start.w / start.h;
    if (Math.abs(w / ratio) > Math.abs(hh)) {
      const nh = Math.sign(hh || 1) * Math.abs(w / ratio);
      if (h.includes("n")) y += hh - nh;
      hh = nh;
    } else {
      const nw = Math.sign(w || 1) * Math.abs(hh * ratio);
      if (h.includes("w")) x += w - nw;
      w = nw;
    }
  }
  return normalizeRect({ x, y, w, h: hh });
}

export function normalizeRect(r: Rect): Rect {
  return {
    x: r.w < 0 ? r.x + r.w : r.x,
    y: r.h < 0 ? r.y + r.h : r.y,
    w: Math.abs(r.w),
    h: Math.abs(r.h),
  };
}

export function cursorForHandle(h: Handle): string {
  if (h === "n" || h === "s") return "ns-resize";
  if (h === "e" || h === "w") return "ew-resize";
  if (h === "nw" || h === "se") return "nwse-resize";
  return "nesw-resize";
}
