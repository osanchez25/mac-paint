import { toCss, type RGBA } from "../core/color";
import { intersect, pixelBounds, type Rect } from "../core/geometry";
import type { HistoryEntry } from "../core/history";
import { copyRegion, writeRegion } from "../core/pixels";

export function createCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("this system cannot create a 2D canvas");
  return ctx;
}

export function cloneCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = createCanvas(src.width, src.height);
  ctx2d(c).drawImage(src, 0, 0);
  return c;
}

/**
 * One layer of the picture. `baseline` is a copy of its last committed
 * pixels, so an undo step only has to store the region that changed.
 */
export class Layer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  baseline: ImageData;

  constructor(readonly id: string, public name: string, width: number, height: number, public visible = true) {
    this.canvas = createCanvas(width, height);
    this.ctx = ctx2d(this.canvas);
    this.baseline = this.ctx.getImageData(0, 0, width, height);
  }

  syncBaseline(): void {
    this.baseline = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
  }

  /** Replaces size and pixels (undo/redo of whole-picture changes). */
  restore(src: HTMLCanvasElement): void {
    this.canvas.width = src.width;
    this.canvas.height = src.height;
    this.ctx.drawImage(src, 0, 0);
    this.syncBaseline();
  }
}

/**
 * The picture: a stack of layers, bottom first, like Paint's Layers panel.
 * Tools draw on the active layer (`canvas`/`ctx`); `commit*` turns what changed
 * into one undo step. Whole-picture changes (crop, rotate, resize) apply to
 * every layer at once.
 */
export class RasterDocument {
  layers: Layer[] = [];
  private activeIdx = 0;
  private nextId = 1;

  constructor(width: number, height: number, background: RGBA) {
    this.reset(null, width, height, background);
  }

  get active(): Layer {
    return this.layers[this.activeIdx];
  }

  get activeIndex(): number {
    return this.activeIdx;
  }

  /** The bottom layer: erasing there paints color 2 instead of making holes, like Paint. */
  get onBackground(): boolean {
    return this.activeIdx === 0;
  }

  get canvas(): HTMLCanvasElement {
    return this.active.canvas;
  }

  get ctx(): CanvasRenderingContext2D {
    return this.active.ctx;
  }

  get width(): number {
    return this.layers[0].canvas.width;
  }

  get height(): number {
    return this.layers[0].canvas.height;
  }

  get bounds(): Rect {
    return { x: 0, y: 0, w: this.width, h: this.height };
  }

  newLayer(width = this.width, height = this.height): Layer {
    const id = `layer-${this.nextId++}`;
    return new Layer(id, `Layer ${this.nextId - 1}`, width, height);
  }

  setActive(id: string): void {
    const i = this.layers.findIndex((l) => l.id === id);
    if (i < 0) throw new Error(`no layer with id ${id}`);
    this.activeIdx = i;
  }

  /** Internal for layer commands: replaces the stack and active index. */
  setStack(layers: Layer[], active: number): void {
    this.layers = layers;
    this.activeIdx = Math.max(0, Math.min(active, layers.length - 1));
  }

  /** Starts over with one layer (new picture, opened file), no undo step. Null background = transparent. */
  reset(source: HTMLCanvasElement | null, width: number, height: number, background: RGBA | null): void {
    this.nextId = 1;
    const layer = this.newLayer(width, height);
    if (background) {
      layer.ctx.fillStyle = toCss(background);
      layer.ctx.fillRect(0, 0, width, height);
    }
    if (source) layer.ctx.drawImage(source, 0, 0);
    layer.syncBaseline();
    this.setStack([layer], 0);
  }

  /** Records the pixels changed inside `area` of the active layer as one undo step. */
  commitRegion(label: string, area: Rect): HistoryEntry | null {
    const layer = this.active;
    const r = intersect(pixelBounds(area), this.bounds);
    if (!r) return null;
    const before = copyRegion(layer.baseline, r);
    const after = copyRegion(layer.ctx.getImageData(r.x, r.y, r.w, r.h), { x: 0, y: 0, w: r.w, h: r.h });
    writeRegion(layer.baseline, after, r);
    const apply = (px: Uint8ClampedArray<ArrayBuffer>) => {
      layer.ctx.putImageData(new ImageData(new Uint8ClampedArray(px), r.w, r.h), r.x, r.y);
      writeRegion(layer.baseline, px, r);
    };
    return { label, bytes: before.byteLength * 2, undo: () => apply(before), redo: () => apply(after) };
  }

  /**
   * Changes every layer at once, possibly to a new size (crop, rotate, resize).
   * `draw` paints each layer's new pixels given a copy of its old ones.
   */
  commitReplace(
    label: string,
    width: number,
    height: number,
    draw: (ctx: CanvasRenderingContext2D, old: HTMLCanvasElement, layerIndex: number) => void,
  ): HistoryEntry {
    const layers = [...this.layers];
    const before = layers.map((l) => cloneCanvas(l.canvas));
    layers.forEach((l, i) => {
      l.canvas.width = width;
      l.canvas.height = height;
      draw(l.ctx, before[i], i);
      l.syncBaseline();
    });
    const after = layers.map((l) => cloneCanvas(l.canvas));
    const bytes = layers.length * (before[0].width * before[0].height + width * height) * 4;
    return {
      label,
      bytes,
      undo: () => layers.forEach((l, i) => l.restore(before[i])),
      redo: () => layers.forEach((l, i) => l.restore(after[i])),
    };
  }

  /** Puts back the active layer's last committed pixels in `area` (cancelling an unfinished change). */
  revert(area: Rect): void {
    const r = intersect(pixelBounds(area), this.bounds);
    if (!r) return;
    const px = copyRegion(this.active.baseline, r);
    this.ctx.putImageData(new ImageData(px, r.w, r.h), r.x, r.y);
  }

  imageData(r: Rect = this.bounds): ImageData {
    return this.ctx.getImageData(r.x, r.y, r.w, r.h);
  }

  /** The color you see at a point (all visible layers), for the color picker. */
  colorAt(x: number, y: number): RGBA | null {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
    const c = createCanvas(1, 1);
    const ctx = ctx2d(c);
    for (const l of this.layers) if (l.visible) ctx.drawImage(l.canvas, x, y, 1, 1, 0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], a: d[3] };
  }

  /** All visible layers in one picture: what gets saved, printed and shown. */
  flatten(): HTMLCanvasElement {
    if (this.layers.length === 1 && this.layers[0].visible) return this.layers[0].canvas;
    const c = createCanvas(this.width, this.height);
    const ctx = ctx2d(c);
    for (const l of this.layers) if (l.visible) ctx.drawImage(l.canvas, 0, 0);
    return c;
  }
}
