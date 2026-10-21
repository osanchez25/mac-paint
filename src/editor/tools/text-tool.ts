import { toCss } from "../../core/color";
import { contains, cursorForHandle, dragHandle, hitHandle, inflate, rectFromPoints, type Handle, type Point, type Rect } from "../../core/geometry";
import { cssFont, LINE_HEIGHT, ptToPx, wrapText } from "../../core/text";
import type { Editor } from "../editor";
import type { Tool, ToolPointer } from "./tool";

type Phase =
  | { k: "idle" }
  | { k: "creating"; start: Point }
  | { k: "moving"; from: Point; start: Rect }
  | { k: "resizing"; handle: Handle; from: Point; start: Rect };

/** How close to the box edge (in screen px) a press moves the box instead of placing the caret. */
const EDGE = 6;

/**
 * Text: drag (or click) to make a text box, type in it, change the font from
 * the Text tab. The text is drawn on the preview layer as you type, so what
 * you see is exactly what lands on the picture when the box is committed.
 */
export class TextTool implements Tool {
  readonly id = "text" as const;
  private phase: Phase = { k: "idle" };

  constructor(private readonly editor: Editor) {}

  down(e: ToolPointer): void {
    const box = this.editor.state.textBox;
    if (box) {
      const handle = hitHandle(box.rect, e.p, e.tolerance);
      if (handle) {
        this.phase = { k: "resizing", handle, from: e.p, start: box.rect };
        return;
      }
      if (contains(inflate(box.rect, EDGE / this.editor.state.zoom), e.p)) {
        this.phase = { k: "moving", from: e.p, start: box.rect };
        return;
      }
      this.commit();
      return;
    }
    this.phase = { k: "creating", start: e.p };
  }

  move(e: ToolPointer, pressed: boolean): void {
    const ph = this.phase;
    const ed = this.editor;
    const box = ed.state.textBox;
    if (ph.k === "creating" && pressed) {
      ed.set({ overlay: { kind: "box", rect: rectFromPoints(ph.start, e.p), handles: false } });
    } else if (ph.k === "moving" && box) {
      this.setRect({ ...ph.start, x: Math.round(ph.start.x + e.p.x - ph.from.x), y: Math.round(ph.start.y + e.p.y - ph.from.y) });
    } else if (ph.k === "resizing" && box) {
      const r = dragHandle(ph.start, ph.handle, e.p.x - ph.from.x, e.p.y - ph.from.y, false);
      this.setRect({ x: Math.round(r.x), y: Math.round(r.y), w: Math.max(8, Math.round(r.w)), h: Math.max(8, Math.round(r.h)) });
    } else if (ph.k === "idle" && box) {
      const h = hitHandle(box.rect, e.p, e.tolerance);
      ed.set({ cursor: h ? cursorForHandle(h) : contains(inflate(box.rect, EDGE / ed.state.zoom), e.p) ? "move" : "text" });
    }
  }

  up(e: ToolPointer): void {
    const ph = this.phase;
    this.phase = { k: "idle" };
    if (ph.k !== "creating") return;
    let rect = rectFromPoints(ph.start, e.p);
    if (rect.w < 8 || rect.h < 8) {
      // A plain click makes a box big enough for a few words, like Paint.
      const lh = ptToPx(this.editor.state.text.size) * LINE_HEIGHT;
      rect = { x: ph.start.x, y: ph.start.y, w: Math.max(160, lh * 8), h: Math.ceil(lh * 2) };
    }
    rect = { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.w), h: Math.round(rect.h) };
    this.editor.set({ textBox: { rect, value: "" } });
    this.render();
  }

  /** Called by the text box as the user types. */
  setValue(value: string): void {
    const box = this.editor.state.textBox;
    if (!box) return;
    // Paint grows the box downward when the text needs more room.
    const needed = this.layout(value, box.rect).height;
    const rect = needed > box.rect.h ? { ...box.rect, h: Math.ceil(needed) } : box.rect;
    this.editor.set({ textBox: { rect, value } });
    this.render();
  }

  refresh(): void {
    this.render();
  }

  key(e: KeyboardEvent): boolean {
    if (!this.editor.state.textBox) return false;
    if (e.key === "Escape") {
      this.commit();
      return true;
    }
    return false;
  }

  commit(): void {
    const box = this.editor.state.textBox;
    this.phase = { k: "idle" };
    if (!box) return;
    if (box.value.trim() === "" && !this.editor.state.text.opaque) {
      this.cancel();
      return;
    }
    this.render(false);
    this.editor.set({ textBox: null, overlay: null });
    this.editor.commitPreview("Text", box.rect);
  }

  cancel(): boolean {
    if (!this.editor.state.textBox) return false;
    this.phase = { k: "idle" };
    this.editor.clearPreview();
    this.editor.set({ textBox: null, overlay: null });
    return true;
  }

  private setRect(rect: Rect): void {
    const box = this.editor.state.textBox;
    if (!box) return;
    this.editor.set({ textBox: { ...box, rect } });
    this.render();
  }

  private layout(value: string, rect: Rect): { lines: string[]; lineHeight: number; height: number } {
    const t = this.editor.state.text;
    const ctx = this.editor.previewCtx;
    ctx.font = cssFont(t.font, t.size, t.bold, t.italic);
    const lines = wrapText(value, rect.w, (s) => ctx.measureText(s).width);
    const lineHeight = ptToPx(t.size) * LINE_HEIGHT;
    return { lines, lineHeight, height: lines.length * lineHeight };
  }

  private render(withOverlay = true): void {
    const ed = this.editor;
    const box = ed.state.textBox;
    ed.clearPreview();
    if (!box) return;
    const t = ed.state.text;
    const ctx = ed.previewCtx;
    const { rect } = box;
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    if (t.opaque) {
      ctx.fillStyle = toCss(ed.state.secondary);
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
    const { lines, lineHeight } = this.layout(box.value, rect);
    const px = ptToPx(t.size);
    ctx.fillStyle = toCss(ed.state.primary);
    ctx.strokeStyle = toCss(ed.state.primary);
    ctx.lineWidth = Math.max(1, px / 14);
    ctx.textBaseline = "alphabetic";
    lines.forEach((line, i) => {
      const baseline = rect.y + i * lineHeight + (lineHeight - px) / 2 + px * 0.85;
      ctx.fillText(line, rect.x, baseline);
      const w = ctx.measureText(line).width;
      if (t.underline) ctx.fillRect(rect.x, baseline + px * 0.1, w, ctx.lineWidth);
      if (t.strike) ctx.fillRect(rect.x, baseline - px * 0.3, w, ctx.lineWidth);
    });
    ctx.restore();
    if (withOverlay) ed.set({ overlay: { kind: "box", rect, handles: true } });
  }
}
