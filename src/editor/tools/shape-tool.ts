import {
  boundsOf,
  contains,
  cursorForHandle,
  dragHandle,
  hitHandle,
  inflate,
  rectFromPoints,
  snapAngle45,
  squareFrom,
  type Handle,
  type Point,
  type Rect,
} from "../../core/geometry";
import { isBoxShape, SHAPE_LABELS } from "../../core/shapes";
import type { Editor } from "../editor";
import { drawShape, shapeBounds, type ShapeSpec } from "../shape-render";
import type { Tool, ToolPointer } from "./tool";

type Phase =
  | { k: "idle" }
  /** First drag: the box, or the line of a line/curve/polygon. */
  | { k: "drawing"; start: Point }
  /** Curve waiting for its first or second bend. */
  | { k: "bend"; which: 1 | 2; dragging: boolean }
  /** Polygon: each click adds a corner until it closes. */
  | { k: "polygon"; dragging: boolean }
  /** Finished shape with handles: can still be moved, resized or restyled. */
  | { k: "editing" }
  | { k: "moving"; from: Point; rect: Rect; points: Point[] }
  | { k: "resizing"; handle: Handle; from: Point; rect: Rect; points: Point[] };

/**
 * Shapes behave like in Windows Paint: after drawing, the shape stays
 * editable (move, resize, change color/size/outline/fill) until you click
 * outside it, switch tools, or press Enter.
 */
export class ShapeTool implements Tool {
  readonly id = "shape" as const;
  private phase: Phase = { k: "idle" };
  private rect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private points: Point[] = [];
  /** Drawn with the right button: outline in color 2, fill in color 1. */
  private swapped = false;

  constructor(private readonly editor: Editor) {}

  down(e: ToolPointer): void {
    const ph = this.phase;
    if (ph.k === "bend") {
      this.phase = { k: "bend", which: ph.which, dragging: true };
      this.bendTo(e.p, ph.which);
      return;
    }
    if (ph.k === "polygon") {
      const first = this.points[0];
      if (e.double || (this.points.length > 2 && Math.hypot(e.p.x - first.x, e.p.y - first.y) <= e.tolerance * 1.5)) {
        this.closePolygon();
        return;
      }
      this.points.push(e.p);
      this.phase = { k: "polygon", dragging: true };
      this.render();
      return;
    }
    if (ph.k === "editing") {
      const bounds = this.editBounds();
      const handle = hitHandle(bounds, e.p, e.tolerance);
      if (handle) {
        this.phase = { k: "resizing", handle, from: e.p, rect: { ...this.rect }, points: this.points.map((p) => ({ ...p })) };
        return;
      }
      if (contains(inflate(bounds, e.tolerance), e.p)) {
        this.phase = { k: "moving", from: e.p, rect: { ...this.rect }, points: this.points.map((p) => ({ ...p })) };
        return;
      }
      this.commit();
    }
    this.swapped = e.button === 2;
    this.rect = { x: e.p.x, y: e.p.y, w: 0, h: 0 };
    this.points = [e.p, e.p];
    this.phase = { k: "drawing", start: e.p };
    this.render();
  }

  move(e: ToolPointer, pressed: boolean): void {
    const ph = this.phase;
    switch (ph.k) {
      case "drawing": {
        if (!pressed) return;
        const kind = this.editor.state.shape;
        if (isBoxShape(kind)) this.rect = rectFromPoints(ph.start, e.shift ? squareFrom(ph.start, e.p) : e.p);
        else this.points[this.points.length - 1] = e.shift ? snapAngle45(ph.start, e.p) : e.p;
        this.render();
        return;
      }
      case "bend":
        if (ph.dragging) this.bendTo(e.p, ph.which);
        return;
      case "polygon": {
        const prev = this.points[this.points.length - 2];
        if (ph.dragging) this.points[this.points.length - 1] = e.shift ? snapAngle45(prev, e.p) : e.p;
        this.render();
        return;
      }
      case "moving": {
        const dx = e.p.x - ph.from.x;
        const dy = e.p.y - ph.from.y;
        this.rect = { ...ph.rect, x: ph.rect.x + dx, y: ph.rect.y + dy };
        this.points = ph.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
        this.render();
        return;
      }
      case "resizing": {
        const startBounds = isBoxShape(this.editor.state.shape) ? ph.rect : boundsOf(ph.points);
        const next = dragHandle(startBounds, ph.handle, e.p.x - ph.from.x, e.p.y - ph.from.y, e.shift);
        if (isBoxShape(this.editor.state.shape)) this.rect = next;
        else this.points = ph.points.map((p) => mapPoint(p, startBounds, next));
        this.render();
        return;
      }
      case "editing": {
        const bounds = this.editBounds();
        const h = hitHandle(bounds, e.p, e.tolerance);
        this.editor.set({ cursor: h ? cursorForHandle(h) : contains(inflate(bounds, e.tolerance), e.p) ? "move" : "crosshair" });
        return;
      }
      default:
        this.editor.set({ cursor: "crosshair" });
    }
  }

  up(e: ToolPointer): void {
    const ph = this.phase;
    const kind = this.editor.state.shape;
    if (ph.k === "drawing") {
      const tiny = isBoxShape(kind) ? this.rect.w < 1 && this.rect.h < 1 : Math.hypot(e.p.x - ph.start.x, e.p.y - ph.start.y) < 1;
      if (tiny) {
        this.cancel();
        return;
      }
      if (kind === "curve") {
        const [a, b] = this.points;
        this.points = [a, a, b, b];
        this.phase = { k: "bend", which: 1, dragging: false };
      } else if (kind === "polygon") {
        this.phase = { k: "polygon", dragging: false };
      } else {
        this.startEditing();
      }
      return;
    }
    if (ph.k === "bend") {
      if (ph.which === 1) this.phase = { k: "bend", which: 2, dragging: false };
      else this.startEditing();
      return;
    }
    if (ph.k === "polygon") {
      this.phase = { k: "polygon", dragging: false };
      // Keep a rubber-band point following the mouse for the next corner.
      this.points.push({ ...this.points[this.points.length - 1] });
      this.render();
      return;
    }
    if (ph.k === "moving" || ph.k === "resizing") this.startEditing();
  }

  key(e: KeyboardEvent): boolean {
    if (this.phase.k === "idle") return false;
    if (e.key === "Escape" || e.key === "Delete" || e.key === "Backspace") {
      this.cancel();
      return true;
    }
    if (e.key === "Enter") {
      if (this.phase.k === "polygon") this.closePolygon();
      else this.commit();
      return true;
    }
    return false;
  }

  refresh(): void {
    if (this.phase.k !== "idle") this.render();
  }

  commit(): void {
    if (this.phase.k === "idle") return;
    if (this.phase.k === "polygon") {
      this.points.pop();
      if (this.points.length < 2) {
        this.cancel();
        return;
      }
    }
    const spec = this.spec(true);
    this.editor.clearPreview();
    drawShape(this.editor.previewCtx, spec);
    this.editor.commitPreview(SHAPE_LABELS[spec.kind], shapeBounds(spec));
    this.finish();
  }

  cancel(): boolean {
    if (this.phase.k === "idle") return false;
    this.editor.clearPreview();
    this.finish();
    return true;
  }

  private finish(): void {
    this.phase = { k: "idle" };
    this.points = [];
    this.editor.set({ overlay: null, hasSelection: false, editingShape: false, selectionSize: null });
  }

  private startEditing(): void {
    this.phase = { k: "editing" };
    this.render();
  }

  private closePolygon(): void {
    if (this.phase.k === "polygon" && !this.phase.dragging) this.points.pop();
    if (this.points.length < 3) {
      this.cancel();
      return;
    }
    this.startEditing();
  }

  private bendTo(p: Point, which: 1 | 2): void {
    if (which === 1) {
      this.points[1] = p;
      this.points[2] = p;
    } else {
      this.points[2] = p;
    }
    this.render();
  }

  private editBounds(): Rect {
    return isBoxShape(this.editor.state.shape) ? this.rect : boundsOf(this.points);
  }

  private spec(closed = this.phase.k !== "polygon"): ShapeSpec {
    const s = this.editor.state;
    return {
      kind: s.shape,
      rect: this.rect,
      points: this.points,
      closed,
      outline: s.outline,
      fill: s.fill,
      stroke: this.swapped ? s.secondary : s.primary,
      fillColor: this.swapped ? s.primary : s.secondary,
      size: s.sizes.shape,
    };
  }

  private render(): void {
    this.editor.clearPreview();
    drawShape(this.editor.previewCtx, this.spec());
    const editing = this.phase.k === "editing" || this.phase.k === "moving" || this.phase.k === "resizing";
    const b = this.editBounds();
    this.editor.set({
      overlay: editing ? { kind: "box", rect: b, handles: true } : null,
      hasSelection: false,
      editingShape: editing,
      selectionSize: { w: Math.round(b.w), h: Math.round(b.h) },
    });
  }
}

function mapPoint(p: Point, from: Rect, to: Rect): Point {
  const u = from.w === 0 ? 0 : (p.x - from.x) / from.w;
  const v = from.h === 0 ? 0 : (p.y - from.y) / from.h;
  return { x: to.x + u * to.w, y: to.y + v * to.h };
}
