import { toCss } from "../core/color";
import { boundsOf, intersect, pixelBounds, union, type Point, type Rect } from "../core/geometry";
import { keyOut } from "../core/pixels";
import { cloneCanvas, createCanvas, ctx2d } from "./document";
import type { Editor } from "./editor";

/**
 * The selected area. A plain selection only marks pixels; it "lifts" them
 * (cut out, leaving color 2 behind) the first time they are moved, resized,
 * rotated or flipped. Lifted pixels float on the preview layer until the
 * selection is committed, which records the whole move as one undo step.
 */
export class Selection {
  private rect: Rect | null = null;
  /** Which pixels of `rect` are selected (alpha), for free-form and inverted selections. Null = all of them. */
  private mask: HTMLCanvasElement | null = null;
  /** Dashed outlines shown inside the box (free-form shape, or the hole of an inverted selection). */
  private outlines: Point[][] = [];
  private content: HTMLCanvasElement | null = null;
  /** Where lifted pixels came from (null for pasted ones). */
  private origin: Rect | null = null;
  private label = "Move selection";
  /** Last transparent-selection result, so moving doesn't recompute it on every mouse move. */
  private keyCache: { src: HTMLCanvasElement; key: string; out: HTMLCanvasElement } | null = null;

  constructor(private readonly editor: Editor) {}

  get active(): boolean {
    return this.rect !== null;
  }

  get floating(): boolean {
    return this.content !== null;
  }

  get bounds(): Rect | null {
    return this.rect ? { ...this.rect } : null;
  }

  /** Marks an area without touching pixels. `polygon` is in picture coordinates. */
  mark(rect: Rect, polygon: Point[] | null = null): void {
    this.commit();
    const r = intersect(pixelBounds(rect), this.editor.doc.bounds);
    if (!r) return;
    this.rect = r;
    this.mask = polygon ? polygonMask(polygon, r) : null;
    this.outlines = polygon ? [polygon] : [];
    this.render();
  }

  /**
   * Invert selection: everything that was not selected becomes the selection.
   * With nothing selected, this selects the whole picture, like Paint.
   */
  invert(): void {
    const doc = this.editor.doc.bounds;
    if (!this.rect) {
      this.mark(doc);
      return;
    }
    if (this.content) this.commitKeepingArea();
    const r = this.rect;
    const m = createCanvas(doc.w, doc.h);
    const mx = ctx2d(m);
    mx.fillStyle = "#000";
    mx.fillRect(0, 0, doc.w, doc.h);
    mx.globalCompositeOperation = "destination-out";
    if (this.mask) mx.drawImage(this.mask, r.x, r.y);
    else mx.fillRect(r.x, r.y, r.w, r.h);
    const hole = this.outlines.length ? this.outlines : [rectOutline(r)];
    this.rect = doc;
    this.mask = m;
    this.outlines = hole;
    this.render();
  }

  /** Places pixels from outside the picture (paste, paste from file). */
  place(content: HTMLCanvasElement, at: Point, label = "Paste"): void {
    this.commit();
    this.content = content;
    this.origin = null;
    this.mask = null;
    this.outlines = [];
    this.label = label;
    this.rect = { x: Math.round(at.x), y: Math.round(at.y), w: content.width, h: content.height };
    this.render();
  }

  /** Cuts the selected pixels out of the picture so they can move. `copy` leaves the original. */
  lift(copy = false): void {
    if (!this.rect || this.content) return;
    const r = this.rect;
    const c = createCanvas(r.w, r.h);
    const cx = ctx2d(c);
    cx.drawImage(this.editor.doc.canvas, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    this.applyMask(cx);
    if (!copy) this.fillHole(r);
    this.content = c;
    this.outlines = [];
    this.origin = copy ? null : { ...r };
    this.label = copy ? "Copy selection" : "Move selection";
  }

  moveTo(x: number, y: number): void {
    if (!this.rect) return;
    this.lift();
    this.rect = { ...this.rect, x: Math.round(x), y: Math.round(y) };
    this.render();
  }

  resizeTo(r: Rect): void {
    if (!this.rect) return;
    this.lift();
    this.rect = { x: Math.round(r.x), y: Math.round(r.y), w: Math.max(1, Math.round(r.w)), h: Math.max(1, Math.round(r.h)) };
    this.render();
  }

  /** Cmd-drag in Paint: leaves a copy where the selection is and keeps moving the original. */
  stampCopy(): void {
    if (!this.rect) return;
    if (!this.content) {
      this.lift(true);
      return;
    }
    this.drawContent(this.editor.doc.ctx);
  }

  /** Replaces the lifted pixels with transformed ones (rotate, flip, resize, skew). */
  transform(label: string, fn: (src: HTMLCanvasElement) => HTMLCanvasElement): void {
    if (!this.rect) return;
    this.lift();
    const src = this.scaledContent();
    const out = fn(src);
    this.content = out;
    this.mask = null;
    this.label = label;
    this.rect = { x: this.rect.x, y: this.rect.y, w: out.width, h: out.height };
    this.render();
  }

  /** The selected pixels as they look now (for copy and crop). */
  pixels(): HTMLCanvasElement | null {
    if (!this.rect) return null;
    if (this.content) return this.keyed(this.scaledContent());
    const r = this.rect;
    const c = createCanvas(r.w, r.h);
    const cx = ctx2d(c);
    cx.drawImage(this.editor.doc.canvas, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    this.applyMask(cx);
    return c;
  }

  /** Delete key: the area becomes color 2. */
  deleteContents(): void {
    if (!this.rect) return;
    const area = union(this.origin, this.rect);
    if (!this.content) this.fillHole(this.rect);
    this.content = null;
    this.clear();
    this.editor.record(this.editor.doc.commitRegion("Delete", area));
  }

  /** Lays floating pixels down and drops the selection. */
  commit(): void {
    if (!this.rect) return;
    if (this.content) {
      const area = union(this.origin, this.rect);
      this.drawContent(this.editor.doc.ctx);
      this.editor.clearPreview();
      this.content = null;
      this.clear();
      this.editor.record(this.editor.doc.commitRegion(this.label, area));
      return;
    }
    this.clear();
  }

  /** Drops the selection; floating pixels go back where they came from. Returns true if pixels were floating. */
  cancel(): boolean {
    if (!this.rect) return false;
    const wasFloating = this.content !== null;
    if (this.origin) this.editor.doc.revert(this.origin);
    this.content = null;
    this.clear();
    return wasFloating;
  }

  /** Redraws the floating pixels and the dashed box (also after color 2 or transparency changes). */
  render(): void {
    const ed = this.editor;
    ed.clearPreview();
    if (this.rect && this.content) this.drawContent(ed.previewCtx);
    ed.set({
      overlay: this.rect ? { kind: "box", rect: this.rect, handles: true, outlines: this.content ? [] : this.outlines } : null,
      hasSelection: this.rect !== null,
      selectionSize: this.rect ? { w: this.rect.w, h: this.rect.h } : null,
    });
  }

  private clear(): void {
    this.rect = null;
    this.mask = null;
    this.outlines = [];
    this.origin = null;
    this.editor.clearPreview();
    this.editor.set({ overlay: null, hasSelection: false, selectionSize: null });
  }

  /** What's left behind: color 2 on the bottom layer, transparency on upper layers (like Paint). */
  private fillHole(r: Rect): void {
    const ctx = this.editor.doc.ctx;
    ctx.save();
    if (!this.editor.doc.onBackground) ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = toCss(this.editor.state.secondary);
    if (this.mask) {
      // Color 2 only where the mask is: paint a colored copy of the mask.
      const c = createCanvas(r.w, r.h);
      const cx = ctx2d(c);
      cx.fillStyle = ctx.fillStyle;
      cx.fillRect(0, 0, r.w, r.h);
      this.applyMask(cx);
      ctx.drawImage(c, r.x, r.y);
    } else {
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    ctx.restore();
  }

  /** Keeps only the selected pixels on a rect-sized canvas. */
  private applyMask(cx: CanvasRenderingContext2D): void {
    if (!this.mask) return;
    cx.save();
    cx.globalCompositeOperation = "destination-in";
    cx.drawImage(this.mask, 0, 0);
    cx.restore();
  }

  /** Lays floating pixels down but keeps their area as the (plain) selection. */
  private commitKeepingArea(): void {
    const r = this.rect;
    this.commit();
    if (r) this.mark(r);
  }

  private drawContent(ctx: CanvasRenderingContext2D): void {
    if (!this.rect || !this.content) return;
    const src = this.keyed(this.content);
    ctx.save();
    ctx.imageSmoothingEnabled = src.width !== this.rect.w || src.height !== this.rect.h;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, this.rect.x, this.rect.y, this.rect.w, this.rect.h);
    ctx.restore();
  }

  /** Content at its current on-screen size. */
  private scaledContent(): HTMLCanvasElement {
    const src = this.content!;
    const r = this.rect!;
    if (src.width === r.w && src.height === r.h) return cloneCanvas(src);
    const c = createCanvas(r.w, r.h);
    const cx = ctx2d(c);
    cx.imageSmoothingQuality = "high";
    cx.drawImage(src, 0, 0, r.w, r.h);
    return c;
  }

  /** "Transparent selection": pixels of color 2 are left out. */
  private keyed(src: HTMLCanvasElement): HTMLCanvasElement {
    const { transparentSelection, secondary } = this.editor.state;
    if (!transparentSelection) return src;
    const key = `${secondary.r},${secondary.g},${secondary.b}`;
    if (this.keyCache?.src === src && this.keyCache.key === key) return this.keyCache.out;
    const c = cloneCanvas(src);
    const cx = ctx2d(c);
    const img = cx.getImageData(0, 0, c.width, c.height);
    keyOut(img, secondary);
    cx.putImageData(img, 0, 0);
    this.keyCache = { src, key, out: c };
    return c;
  }
}

/** Alpha mask of a free-form outline (picture coordinates) inside `r`. */
function polygonMask(points: readonly Point[], r: Rect): HTMLCanvasElement {
  const m = createCanvas(r.w, r.h);
  const mx = ctx2d(m);
  mx.beginPath();
  points.forEach((q, i) => (i === 0 ? mx.moveTo(q.x - r.x, q.y - r.y) : mx.lineTo(q.x - r.x, q.y - r.y)));
  mx.closePath();
  mx.fillStyle = "#000";
  mx.fill();
  return m;
}

function rectOutline(r: Rect): Point[] {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
  ];
}

export function polygonBounds(points: readonly Point[]): Rect {
  return pixelBounds(boundsOf(points));
}
