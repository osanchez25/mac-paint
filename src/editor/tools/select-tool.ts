import { contains, cursorForHandle, dragHandle, hitHandle, rectFromPoints, type Handle, type Point, type Rect } from "../../core/geometry";
import type { Editor } from "../editor";
import { polygonBounds, type Selection } from "../selection";
import type { Tool, ToolPointer } from "./tool";

type Phase =
  | { k: "idle" }
  | { k: "marquee"; start: Point }
  | { k: "lasso"; points: Point[] }
  | { k: "moving"; from: Point; start: Rect }
  | { k: "resizing"; handle: Handle; from: Point; start: Rect };

/** Rectangle and free-form selection, with Paint's move, resize and Cmd-drag copy. */
export class SelectTool implements Tool {
  readonly id = "select" as const;
  private phase: Phase = { k: "idle" };

  constructor(private readonly editor: Editor, private readonly selection: Selection) {}

  down(e: ToolPointer): void {
    const sel = this.selection;
    const b = sel.bounds;
    if (b) {
      const handle = hitHandle(b, e.p, e.tolerance);
      if (handle) {
        this.phase = { k: "resizing", handle, from: e.p, start: b };
        return;
      }
      if (contains(b, e.p)) {
        if (e.mod) sel.stampCopy();
        else sel.lift();
        this.phase = { k: "moving", from: e.p, start: b };
        return;
      }
      sel.commit();
    }
    if (this.editor.state.selectMode === "freeform") {
      this.phase = { k: "lasso", points: [clampToDoc(this.editor, e.p)] };
    } else {
      this.phase = { k: "marquee", start: clampToDoc(this.editor, e.p) };
    }
  }

  move(e: ToolPointer, pressed: boolean): void {
    const ph = this.phase;
    const ed = this.editor;
    switch (ph.k) {
      case "marquee": {
        const r = rectFromPoints(ph.start, clampToDoc(ed, e.p));
        ed.set({ overlay: { kind: "box", rect: r, handles: false }, selectionSize: { w: Math.round(r.w), h: Math.round(r.h) } });
        return;
      }
      case "lasso": {
        ph.points.push(clampToDoc(ed, e.p));
        const b = polygonBounds(ph.points);
        ed.set({ overlay: { kind: "lasso", points: [...ph.points] }, selectionSize: { w: b.w, h: b.h } });
        return;
      }
      case "moving":
        this.selection.moveTo(ph.start.x + e.p.x - ph.from.x, ph.start.y + e.p.y - ph.from.y);
        return;
      case "resizing":
        this.selection.resizeTo(dragHandle(ph.start, ph.handle, e.p.x - ph.from.x, e.p.y - ph.from.y, e.shift));
        return;
      case "idle": {
        if (pressed) return;
        const b = this.selection.bounds;
        const h = b ? hitHandle(b, e.p, e.tolerance) : null;
        ed.set({ cursor: h ? cursorForHandle(h) : b && contains(b, e.p) ? "move" : "crosshair" });
      }
    }
  }

  up(e: ToolPointer): void {
    const ph = this.phase;
    this.phase = { k: "idle" };
    if (ph.k === "marquee") {
      const r = rectFromPoints(ph.start, clampToDoc(this.editor, e.p));
      if (r.w >= 1 && r.h >= 1) this.selection.mark(r);
      else this.editor.set({ overlay: null, selectionSize: null });
    } else if (ph.k === "lasso") {
      const b = polygonBounds(ph.points);
      if (ph.points.length > 2 && b.w >= 1 && b.h >= 1) this.selection.mark(b, ph.points);
      else this.editor.set({ overlay: null, selectionSize: null });
    }
  }

  key(e: KeyboardEvent): boolean {
    const b = this.selection.bounds;
    if (!b) return false;
    const step = e.shiftKey ? 10 : 1;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const m = moves[e.key];
    if (m) {
      this.selection.moveTo(b.x + m[0], b.y + m[1]);
      return true;
    }
    if (e.key === "Escape" || e.key === "Enter") {
      this.selection.commit();
      return true;
    }
    return false;
  }

  refresh(): void {
    if (this.selection.floating) this.selection.render();
  }

  commit(): void {
    this.phase = { k: "idle" };
    this.selection.commit();
  }

  cancel(): boolean {
    this.phase = { k: "idle" };
    return this.selection.cancel();
  }
}

function clampToDoc(ed: Editor, p: Point): Point {
  return { x: Math.max(0, Math.min(ed.doc.width, p.x)), y: Math.max(0, Math.min(ed.doc.height, p.y)) };
}
