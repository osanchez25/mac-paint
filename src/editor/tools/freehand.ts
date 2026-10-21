import { sameColor, toCss } from "../../core/color";
import { inflate, linePixels, union, type Point, type Rect } from "../../core/geometry";
import { createEngine, type BrushEngine, type EngineKind, type StrokeStyle } from "../brushes/engines";
import type { Editor } from "../editor";
import type { Tool, ToolPointer } from "./tool";

const LABELS: Record<"pencil" | "brush" | "eraser", string> = { pencil: "Pencil", brush: "Brush", eraser: "Eraser" };

/**
 * Pencil, brushes and eraser: a stroke is drawn on the preview layer and laid
 * on the picture when the button is released (one undo step per stroke).
 */
export class FreehandTool implements Tool {
  private engine: BrushEngine | null = null;
  private style: StrokeStyle | null = null;
  private last: Point | null = null;
  private area: Rect | null = null;
  private timer: number | null = null;
  /** Right-drag with the eraser swaps color 1 for color 2 instead of erasing. */
  private replacing = false;
  /** The eraser on an upper layer makes pixels transparent, drawing straight onto the layer. */
  private erasing = false;

  constructor(private readonly editor: Editor, readonly id: "pencil" | "brush" | "eraser") {}

  down(e: ToolPointer): void {
    const ed = this.editor;
    const s = ed.state;
    this.replacing = this.id === "eraser" && e.button === 2;
    this.erasing = this.id === "eraser" && !this.replacing && !ed.doc.onBackground;
    const kind: EngineKind = this.id === "brush" ? s.brush : this.id;
    const color = this.id === "eraser" ? s.secondary : ed.colorFor(e.button);
    this.style = { color, size: ed.currentSize() };
    this.last = e.p;
    ed.clearPreview();

    if (this.replacing) {
      this.area = this.replaceAlong(e.p, e.p);
      return;
    }
    this.engine = createEngine(kind, ed.doc.width, ed.doc.height);
    ed.preview.style.opacity = String(this.engine.opacity);
    const engine = this.engine;
    const style = this.style;
    this.area = this.paint((ctx) => engine.begin(ctx, e.p, style));
    if (engine.continuous) {
      this.timer = window.setInterval(() => {
        const at = this.last;
        if (engine.tick && at) this.area = union(this.area, this.paint((ctx) => engine.tick!(ctx, at, style)));
      }, 30);
    }
  }

  move(e: ToolPointer, pressed: boolean): void {
    if (!pressed || !this.last || !this.style) return;
    if (this.replacing) {
      this.area = union(this.area, this.replaceAlong(this.last, e.p));
    } else if (this.engine) {
      const { engine, last, style } = { engine: this.engine, last: this.last, style: this.style };
      this.area = union(this.area, this.paint((ctx) => engine.to(ctx, last, e.p, style)));
    }
    this.last = e.p;
  }

  up(): void {
    this.finish();
  }

  commit(): void {
    this.finish();
  }

  cancel(): boolean {
    if (!this.last) return false;
    this.stopTimer();
    if (this.area) this.editor.doc.revert(this.area);
    this.editor.clearPreview();
    this.reset();
    return true;
  }

  private finish(): void {
    this.stopTimer();
    if (!this.last || !this.area) return this.reset();
    const label = LABELS[this.id];
    if (this.replacing || this.erasing) this.editor.record(this.editor.doc.commitRegion(label, this.area));
    else this.editor.commitPreview(label, this.area, this.engine?.opacity ?? 1);
    this.reset();
  }

  private reset(): void {
    this.engine = null;
    this.style = null;
    this.last = null;
    this.area = null;
    this.replacing = false;
    this.erasing = false;
  }

  /** Strokes go to the preview layer, except erasing on an upper layer, which cuts the layer directly. */
  private paint(draw: (ctx: CanvasRenderingContext2D) => Rect): Rect {
    if (!this.erasing) return draw(this.editor.previewCtx);
    const ctx = this.editor.doc.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    const r = draw(ctx);
    ctx.restore();
    return r;
  }

  private stopTimer(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  /** Classic Paint eraser right-drag: pixels of color 1 under the eraser become color 2. */
  private replaceAlong(a: Point, b: Point): Rect {
    const { doc, state } = this.editor;
    const n = Math.max(1, this.editor.currentSize());
    const off = Math.floor(n / 2);
    const from = state.primary;
    doc.ctx.fillStyle = toCss(state.secondary);
    for (const q of linePixels({ x: Math.floor(a.x), y: Math.floor(a.y) }, { x: Math.floor(b.x), y: Math.floor(b.y) })) {
      const x0 = Math.max(0, q.x - off);
      const y0 = Math.max(0, q.y - off);
      const w = Math.min(doc.width, q.x - off + n) - x0;
      const h = Math.min(doc.height, q.y - off + n) - y0;
      if (w <= 0 || h <= 0) continue;
      const img = doc.ctx.getImageData(x0, y0, w, h);
      for (let i = 0; i < img.data.length; i += 4) {
        const c = { r: img.data[i], g: img.data[i + 1], b: img.data[i + 2], a: img.data[i + 3] };
        if (sameColor(c, from)) {
          img.data[i] = state.secondary.r;
          img.data[i + 1] = state.secondary.g;
          img.data[i + 2] = state.secondary.b;
          img.data[i + 3] = state.secondary.a;
        }
      }
      doc.ctx.putImageData(img, x0, y0);
    }
    return inflate(union({ x: a.x, y: a.y, w: 0, h: 0 }, { x: b.x, y: b.y, w: 0, h: 0 }), n + 2);
  }
}
