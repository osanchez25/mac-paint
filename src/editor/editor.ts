import { toHex, type RGBA } from "../core/color";
import type { Point, Rect } from "../core/geometry";
import { History, type HistoryEntry } from "../core/history";
import { clampZoom, nextZoom } from "../core/image-math";
import { createCanvas, ctx2d, RasterDocument } from "./document";
import { initialState, sizeGroupOf, type EditorState, type ToolId } from "./state";
import { Store } from "./store";
import type { Tool, ToolPointer } from "./tools/tool";

export interface Viewport {
  /** Top-left of the visible part of the picture, in picture pixels. */
  origin(): Point;
  /** Size of the area around the canvas, in screen pixels. */
  size(): { w: number; h: number };
  /** After the next render at `zoom`, scroll so picture point `p` stays where it is on screen. */
  keepPoint(p: Point, zoom: number): void;
}

/**
 * The paint editor: one picture, a preview layer for strokes and shapes in
 * progress, the active tool and the undo history. The UI reads `store` and
 * calls methods; nothing here knows about React.
 */
export class Editor {
  readonly store = new Store<EditorState>(initialState());
  readonly doc: RasterDocument;
  readonly preview: HTMLCanvasElement;
  readonly previewCtx: CanvasRenderingContext2D;
  readonly history = new History();
  private tools = new Map<ToolId, Tool>();
  private viewport: Viewport | null = null;
  /** Tool to return to after the color picker picks a color. */
  private lastTool: ToolId = "pencil";

  constructor() {
    const s = this.store.get();
    this.doc = new RasterDocument(s.width, s.height, s.secondary);
    this.preview = createCanvas(s.width, s.height);
    this.previewCtx = ctx2d(this.preview);
    this.syncLayers();
  }

  /** Copies the layer stack (names, visibility, active one) into the state the panel reads. */
  syncLayers(): void {
    const doc = this.doc;
    this.set({
      layers: doc.layers.map((l) => ({ id: l.id, name: l.name, visible: l.visible })),
      activeLayer: doc.active.id,
      pixelsVersion: this.state.pixelsVersion + 1,
    });
  }

  get state(): EditorState {
    return this.store.get();
  }

  set(patch: Partial<EditorState>): void {
    this.store.set(patch);
  }

  registerTool(tool: Tool): void {
    this.tools.set(tool.id, tool);
  }

  tool(id: ToolId = this.state.tool): Tool {
    const t = this.tools.get(id);
    if (!t) throw new Error(`tool "${id}" is not registered`);
    return t;
  }

  attachViewport(v: Viewport | null): void {
    this.viewport = v;
  }

  viewportOrigin(): Point {
    return this.viewport?.origin() ?? { x: 0, y: 0 };
  }

  // ---- tools -------------------------------------------------------------

  setTool(id: ToolId): void {
    const current = this.state.tool;
    if (current !== id) {
      this.tool(current).commit();
      if (current !== "picker" && current !== "magnifier") this.lastTool = current;
    }
    this.set({ tool: id, cursor: cursorFor(id) });
  }

  /** The color picker hands control back to the tool used before it, like Paint. */
  returnFromPicker(): void {
    this.setTool(this.lastTool);
  }

  pointerDown(e: ToolPointer): void {
    this.tool().down(e);
  }

  pointerMove(e: ToolPointer, pressed: boolean): void {
    const inside = e.p.x >= 0 && e.p.y >= 0 && e.p.x < this.doc.width && e.p.y < this.doc.height;
    this.set({ cursorPos: inside ? { x: Math.floor(e.p.x), y: Math.floor(e.p.y) } : null });
    this.tool().move(e, pressed);
  }

  pointerUp(e: ToolPointer): void {
    this.tool().up(e);
  }

  pointerLeave(): void {
    this.set({ cursorPos: null });
  }

  /** Ribbon settings changed: let the tool redraw a shape or text box still being edited. */
  refreshTool(): void {
    this.tool().refresh?.();
  }

  // ---- colors and sizes ----------------------------------------------------

  colorFor(button: 1 | 2): RGBA {
    return button === 1 ? this.state.primary : this.state.secondary;
  }

  setColor(slot: 1 | 2, color: RGBA): void {
    this.set(slot === 1 ? { primary: color } : { secondary: color });
    this.refreshTool();
  }

  /** Clicking a palette swatch: left sets the selected slot, right always sets color 2. */
  pickSwatch(color: RGBA, button: 1 | 2): void {
    this.setColor(button === 2 ? 2 : this.state.activeSlot, color);
  }

  addCustomColor(color: RGBA): void {
    const hex = toHex(color);
    const list = [...this.state.customColors];
    if (list.includes(hex)) return;
    const free = list.indexOf(null);
    if (free >= 0) list[free] = hex;
    else {
      list.shift();
      list.push(hex);
    }
    this.set({ customColors: list });
  }

  setSize(size: number): void {
    const group = sizeGroupOf(this.state);
    this.set({ sizes: { ...this.state.sizes, [group]: Math.max(1, Math.round(size)) } });
    this.refreshTool();
  }

  currentSize(): number {
    return this.state.sizes[sizeGroupOf(this.state)];
  }

  // ---- zoom ------------------------------------------------------------------

  /** `anchor` is the picture point that should stay put (default: the middle of the view). */
  setZoom(zoom: number, anchor?: Point): void {
    const z = clampZoom(zoom);
    if (anchor) this.viewport?.keepPoint(anchor, z);
    this.set({ zoom: z });
  }

  zoomStep(dir: 1 | -1, anchor?: Point): void {
    this.setZoom(nextZoom(this.state.zoom, dir), anchor);
  }

  zoomToFit(): void {
    const v = this.viewport?.size();
    if (!v) return;
    const pad = 48;
    const z = Math.min((v.w - pad) / this.doc.width, (v.h - pad) / this.doc.height, 1);
    this.setZoom(Math.max(0.05, z));
  }

  // ---- picture and history ------------------------------------------------------

  /** Clears the preview layer, keeping it the picture's size. */
  clearPreview(): void {
    if (this.preview.width !== this.doc.width || this.preview.height !== this.doc.height) {
      this.preview.width = this.doc.width;
      this.preview.height = this.doc.height;
    }
    this.previewCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.previewCtx.globalAlpha = 1;
    this.previewCtx.globalCompositeOperation = "source-over";
    this.previewCtx.clearRect(0, 0, this.preview.width, this.preview.height);
    this.preview.style.opacity = "1";
  }

  /** Lays the preview layer on the active layer and records it as one undo step. */
  commitPreview(label: string, area: Rect, opacity = 1): void {
    this.doc.ctx.save();
    this.doc.ctx.globalAlpha = opacity;
    this.doc.ctx.drawImage(this.preview, 0, 0);
    this.doc.ctx.restore();
    this.clearPreview();
    this.record(this.doc.commitRegion(label, area));
  }

  /** Adds a finished change to the undo history and marks the picture as changed. */
  record(entry: HistoryEntry | null): void {
    if (!entry) return;
    this.history.push(entry);
    this.afterChange();
  }

  undo(): void {
    // Undo while a selection or shape is still being edited throws that edit away.
    if (this.tool().cancel()) return;
    if (this.history.undo()) this.afterChange();
  }

  redo(): void {
    this.tool().commit();
    if (this.history.redo()) this.afterChange();
  }

  /** Call after the picture's pixels or size changed. */
  afterChange(): void {
    this.set({
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
      dirty: true,
      width: this.doc.width,
      height: this.doc.height,
    });
    this.syncLayers();
    if (this.preview.width !== this.doc.width || this.preview.height !== this.doc.height) this.clearPreview();
  }

  /** Replaces the picture with no undo step (new picture or opened file). */
  load(source: HTMLCanvasElement | null, width: number, height: number, file: EditorState["file"]): void {
    for (const t of this.tools.values()) t.cancel();
    // A new picture is white; an opened one keeps its transparency.
    this.doc.reset(source, width, height, source ? null : { r: 255, g: 255, b: 255, a: 255 });
    this.history.clear();
    this.clearPreview();
    this.set({
      width,
      height,
      file,
      dirty: false,
      canUndo: false,
      canRedo: false,
      overlay: null,
      hasSelection: false,
      selectionSize: null,
      textBox: null,
    });
    this.syncLayers();
  }

  showError(text: string): void {
    this.set({ message: { intent: "error", text } });
  }

  showSuccess(text: string): void {
    this.set({ message: { intent: "success", text } });
  }
}

/** Each tool's resting cursor; "tool" means the UI draws the tool's own cursor (pencil, brush tip…). */
export function cursorFor(tool: ToolId): string {
  return tool === "select" || tool === "shape" ? "crosshair" : "tool";
}
