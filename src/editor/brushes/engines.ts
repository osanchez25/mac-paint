import { toCss, type RGBA } from "../../core/color";
import { inflate, linePixels, stepsBetween, union, type Point, type Rect } from "../../core/geometry";
import { seededRandom } from "../../core/random";
import type { BrushKind } from "../state";
import { createCanvas, ctx2d } from "../document";

export interface StrokeStyle {
  color: RGBA;
  size: number;
}

/**
 * Draws one stroke onto a stroke layer. The finished layer is laid on the
 * picture at `opacity`, so a marker stroke is evenly see-through even where
 * it crosses itself, like in Paint.
 */
export interface BrushEngine {
  readonly opacity: number;
  /** The airbrush keeps spraying while the button is held still. */
  readonly continuous: boolean;
  begin(ctx: CanvasRenderingContext2D, p: Point, s: StrokeStyle): Rect;
  to(ctx: CanvasRenderingContext2D, from: Point, to: Point, s: StrokeStyle): Rect;
  tick?(ctx: CanvasRenderingContext2D, p: Point, s: StrokeStyle): Rect;
}

export type EngineKind = BrushKind | "pencil" | "eraser";

const segBounds = (a: Point, b: Point, size: number): Rect =>
  inflate(union({ x: a.x, y: a.y, w: 0, h: 0 }, { x: b.x, y: b.y, w: 0, h: 0 }), size / 2 + 2);

/** Hard square pixels along a Bresenham line: Paint's pencil and eraser. */
class PixelEngine implements BrushEngine {
  readonly opacity = 1;
  readonly continuous = false;
  begin(ctx: CanvasRenderingContext2D, p: Point, s: StrokeStyle): Rect {
    return this.to(ctx, p, p, s);
  }
  to(ctx: CanvasRenderingContext2D, from: Point, to: Point, s: StrokeStyle): Rect {
    const n = Math.max(1, Math.round(s.size));
    const off = Math.floor(n / 2);
    ctx.fillStyle = toCss(s.color);
    for (const q of linePixels({ x: Math.floor(from.x), y: Math.floor(from.y) }, { x: Math.floor(to.x), y: Math.floor(to.y) })) {
      ctx.fillRect(q.x - off, q.y - off, n, n);
    }
    return segBounds(from, to, n + 2);
  }
}

/** Round solid line: the plain Brush and the Marker (which is see-through). */
class RoundEngine implements BrushEngine {
  readonly continuous = false;
  constructor(readonly opacity: number, private readonly cap: CanvasLineCap) {}
  begin(ctx: CanvasRenderingContext2D, p: Point, s: StrokeStyle): Rect {
    return this.to(ctx, p, { x: p.x + 0.01, y: p.y }, s);
  }
  to(ctx: CanvasRenderingContext2D, from: Point, to: Point, s: StrokeStyle): Rect {
    ctx.strokeStyle = toCss(s.color);
    ctx.lineWidth = s.size;
    ctx.lineCap = this.cap;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    return segBounds(from, to, s.size * 1.5);
  }
}

/** Flat nib held at a fixed angle: thin one way, wide the other. */
class NibEngine implements BrushEngine {
  readonly opacity = 1;
  readonly continuous = false;
  private readonly dx: number;
  private readonly dy: number;
  constructor(angleDeg: number, private readonly soft: boolean) {
    this.dx = Math.cos((angleDeg * Math.PI) / 180);
    this.dy = -Math.sin((angleDeg * Math.PI) / 180);
  }
  begin(ctx: CanvasRenderingContext2D, p: Point, s: StrokeStyle): Rect {
    return this.to(ctx, p, p, s);
  }
  to(ctx: CanvasRenderingContext2D, from: Point, to: Point, s: StrokeStyle): Rect {
    const half = Math.max(1, s.size) / 2;
    const ox = this.dx * half;
    const oy = this.dy * half;
    ctx.fillStyle = toCss(s.color);
    ctx.strokeStyle = toCss(s.color);
    ctx.lineWidth = this.soft ? 1.5 : 1;
    ctx.beginPath();
    ctx.moveTo(from.x - ox, from.y - oy);
    ctx.lineTo(from.x + ox, from.y + oy);
    ctx.lineTo(to.x + ox, to.y + oy);
    ctx.lineTo(to.x - ox, to.y - oy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    return segBounds(from, to, s.size + 3);
  }
}

/** Sprays single dots inside a circle, more the longer it stays in one place. */
class AirbrushEngine implements BrushEngine {
  readonly opacity = 1;
  readonly continuous = true;
  constructor(private readonly rand: () => number) {}
  begin(ctx: CanvasRenderingContext2D, p: Point, s: StrokeStyle): Rect {
    return this.spray(ctx, p, s);
  }
  to(ctx: CanvasRenderingContext2D, from: Point, to: Point, s: StrokeStyle): Rect {
    let r: Rect | null = null;
    for (const q of stepsBetween(from, to, Math.max(2, s.size / 2))) r = union(r, this.spray(ctx, q, s));
    return r ?? this.spray(ctx, to, s);
  }
  tick(ctx: CanvasRenderingContext2D, p: Point, s: StrokeStyle): Rect {
    return this.spray(ctx, p, s);
  }
  private spray(ctx: CanvasRenderingContext2D, p: Point, s: StrokeStyle): Rect {
    const radius = Math.max(4, s.size * 2.5);
    const dots = Math.ceil(radius * 0.9);
    ctx.fillStyle = toCss(s.color);
    for (let i = 0; i < dots; i++) {
      const a = this.rand() * Math.PI * 2;
      const d = Math.sqrt(this.rand()) * radius;
      ctx.fillRect(Math.floor(p.x + Math.cos(a) * d), Math.floor(p.y + Math.sin(a) * d), 1, 1);
    }
    return inflate({ x: p.x, y: p.y, w: 0, h: 0 }, radius + 2);
  }
}

/** Thick paint dragged by bristles of slightly different shades. */
class OilEngine implements BrushEngine {
  readonly opacity = 0.92;
  readonly continuous = false;
  private bristles: { offset: number; width: number; shade: number }[] = [];
  constructor(private readonly rand: () => number) {}
  begin(ctx: CanvasRenderingContext2D, p: Point, s: StrokeStyle): Rect {
    const count = Math.max(4, Math.round(s.size * 1.2));
    this.bristles = Array.from({ length: count }, () => ({
      offset: (this.rand() - 0.5) * s.size * 1.6,
      width: 0.8 + this.rand() * Math.max(1, s.size / 5),
      shade: 0.78 + this.rand() * 0.35,
    }));
    return this.to(ctx, p, { x: p.x + 0.5, y: p.y + 0.5 }, s);
  }
  to(ctx: CanvasRenderingContext2D, from: Point, to: Point, s: StrokeStyle): Rect {
    const len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    const nx = -(to.y - from.y) / len;
    const ny = (to.x - from.x) / len;
    ctx.lineCap = "round";
    for (const b of this.bristles) {
      const c = s.color;
      ctx.strokeStyle = toCss({ r: c.r * b.shade, g: c.g * b.shade, b: c.b * b.shade, a: 255 });
      ctx.lineWidth = b.width;
      ctx.beginPath();
      ctx.moveTo(from.x + nx * b.offset, from.y + ny * b.offset);
      ctx.lineTo(to.x + nx * b.offset, to.y + ny * b.offset);
      ctx.stroke();
    }
    return segBounds(from, to, s.size * 2);
  }
}

/**
 * Grainy media (crayon, natural pencil): the stroke shape is drawn solid on a
 * mask, then the paper grain is cut out of it, so crossing the stroke over
 * itself does not darken it.
 */
class GrainEngine implements BrushEngine {
  readonly continuous = false;
  private readonly mask: HTMLCanvasElement;
  private readonly mctx: CanvasRenderingContext2D;
  private pattern: CanvasPattern | null = null;
  constructor(
    readonly opacity: number,
    private readonly widthScale: number,
    private readonly grain: (rand: () => number) => number,
    private readonly rand: () => number,
    w: number,
    h: number,
  ) {
    this.mask = createCanvas(w, h);
    this.mctx = ctx2d(this.mask);
  }
  begin(ctx: CanvasRenderingContext2D, p: Point, s: StrokeStyle): Rect {
    this.pattern = this.makePattern(ctx, s.color);
    return this.to(ctx, p, { x: p.x + 0.01, y: p.y }, s);
  }
  to(ctx: CanvasRenderingContext2D, from: Point, to: Point, s: StrokeStyle): Rect {
    const m = this.mctx;
    m.strokeStyle = "#000";
    m.lineWidth = Math.max(1, s.size * this.widthScale);
    m.lineCap = "round";
    m.lineJoin = "round";
    m.beginPath();
    m.moveTo(from.x, from.y);
    m.lineTo(to.x, to.y);
    m.stroke();
    const r = segBounds(from, to, s.size * this.widthScale + 2);
    const x = Math.floor(r.x);
    const y = Math.floor(r.y);
    const w = Math.ceil(r.w) + 1;
    const h = Math.ceil(r.h) + 1;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.clearRect(x, y, w, h);
    ctx.drawImage(this.mask, 0, 0);
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = this.pattern ?? toCss(s.color);
    ctx.fillRect(x, y, w, h);
    ctx.restore();
    return r;
  }
  private makePattern(ctx: CanvasRenderingContext2D, color: RGBA): CanvasPattern | null {
    const tile = createCanvas(96, 96);
    const t = ctx2d(tile);
    const img = t.createImageData(96, 96);
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = color.r;
      img.data[i + 1] = color.g;
      img.data[i + 2] = color.b;
      img.data[i + 3] = this.grain(this.rand);
    }
    t.putImageData(img, 0, 0);
    return ctx.createPattern(tile, "repeat");
  }
}

/** Soft, see-through dabs that pool where they overlap. */
class WatercolorEngine implements BrushEngine {
  readonly opacity = 0.8;
  readonly continuous = false;
  constructor(private readonly rand: () => number) {}
  begin(ctx: CanvasRenderingContext2D, p: Point, s: StrokeStyle): Rect {
    return this.dab(ctx, p, s);
  }
  to(ctx: CanvasRenderingContext2D, from: Point, to: Point, s: StrokeStyle): Rect {
    let r: Rect | null = null;
    for (const q of stepsBetween(from, to, Math.max(1, s.size / 4))) r = union(r, this.dab(ctx, q, s));
    return r ?? this.dab(ctx, to, s);
  }
  private dab(ctx: CanvasRenderingContext2D, p: Point, s: StrokeStyle): Rect {
    const radius = Math.max(2, s.size * (0.9 + this.rand() * 0.2));
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
    const { r, g: gg, b } = s.color;
    g.addColorStop(0, `rgba(${r}, ${gg}, ${b}, 0.10)`);
    g.addColorStop(0.7, `rgba(${r}, ${gg}, ${b}, 0.07)`);
    g.addColorStop(1, `rgba(${r}, ${gg}, ${b}, 0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
    return inflate({ x: p.x, y: p.y, w: 0, h: 0 }, radius + 1);
  }
}

/** Makes the engine for one stroke. `w`/`h` is the picture size (grain brushes need a mask). */
export function createEngine(kind: EngineKind, w: number, h: number, seed = Date.now()): BrushEngine {
  const rand = seededRandom(seed);
  switch (kind) {
    case "pencil":
    case "eraser":
      return new PixelEngine();
    case "brush":
      return new RoundEngine(1, "round");
    case "marker":
      return new RoundEngine(0.5, "square");
    case "calligraphyBrush":
      return new NibEngine(45, true);
    case "calligraphyPen":
      return new NibEngine(135, false);
    case "airbrush":
      return new AirbrushEngine(rand);
    case "oil":
      return new OilEngine(rand);
    case "crayon":
      return new GrainEngine(1, 1, (r) => (r() < 0.62 ? 170 + r() * 85 : r() * 40), rand, w, h);
    case "naturalPencil":
      return new GrainEngine(0.85, 0.6, (r) => (r() < 0.5 ? 90 + r() * 120 : r() * 30), rand, w, h);
    case "watercolor":
      return new WatercolorEngine(rand);
  }
}
