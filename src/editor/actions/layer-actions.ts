import type { HistoryEntry } from "../../core/history";
import { cloneCanvas, type Layer } from "../document";
import type { Editor } from "../editor";

/** Paint's Layers panel: add, duplicate, delete, merge down, reorder, show/hide, pick. */
export class LayerActions {
  constructor(private readonly editor: Editor) {}

  private get doc() {
    return this.editor.doc;
  }

  togglePanel(): void {
    this.editor.set({ layersPanel: !this.editor.state.layersPanel });
  }

  select(id: string): void {
    if (this.doc.active.id === id) return;
    this.editor.tool().commit();
    this.doc.setActive(id);
    this.editor.syncLayers();
  }

  /** New transparent layer right above the active one. */
  add(): void {
    const layer = this.doc.newLayer();
    this.restack("Add layer", (layers, active) => {
      layers.splice(active + 1, 0, layer);
      return active + 1;
    });
  }

  duplicate(): void {
    const src = this.doc.active;
    const copy = this.doc.newLayer();
    copy.name = `${src.name} copy`;
    copy.ctx.drawImage(src.canvas, 0, 0);
    copy.syncBaseline();
    copy.visible = src.visible;
    this.restack("Duplicate layer", (layers, active) => {
      layers.splice(active + 1, 0, copy);
      return active + 1;
    });
  }

  remove(): void {
    if (this.doc.layers.length < 2) return;
    this.restack("Delete layer", (layers, active) => {
      layers.splice(active, 1);
      return Math.max(0, active - 1);
    });
  }

  /** Lays the active layer onto the one below it; the two become one. */
  mergeDown(): void {
    const doc = this.doc;
    const i = doc.activeIndex;
    if (i === 0) return;
    this.editor.tool().commit();
    const top = doc.layers[i];
    const below = doc.layers[i - 1];
    const before = cloneCanvas(below.canvas);
    if (top.visible) below.ctx.drawImage(top.canvas, 0, 0);
    below.syncBaseline();
    const after = cloneCanvas(below.canvas);
    const entry = this.restack("Merge down", (layers) => {
      layers.splice(i, 1);
      return i - 1;
    }, false);
    this.editor.record({
      label: "Merge down",
      bytes: entry.bytes + before.width * before.height * 8,
      undo: () => {
        below.restore(before);
        entry.undo();
      },
      redo: () => {
        below.restore(after);
        entry.redo();
      },
    });
  }

  /** Moves a layer to `to` (0 = bottom), e.g. after dragging it in the panel. */
  move(id: string, to: number): void {
    const from = this.doc.layers.findIndex((l) => l.id === id);
    if (from < 0 || from === to) return;
    const activeId = this.doc.active.id;
    this.restack("Move layer", (layers) => {
      const [l] = layers.splice(from, 1);
      layers.splice(Math.max(0, Math.min(to, layers.length)), 0, l);
      return layers.findIndex((x) => x.id === activeId);
    });
  }

  /** Hiding is a view choice, like in Paint: it is not an undo step, but it changes what gets saved. */
  toggleVisible(id: string): void {
    const layer = this.doc.layers.find((l) => l.id === id);
    if (!layer) return;
    layer.visible = !layer.visible;
    this.editor.syncLayers();
    this.editor.set({ dirty: true });
  }

  /**
   * Changes the layer stack as one undo step. `change` edits a copy of the
   * stack and returns the new active index. With `record` false the caller
   * records it (merge down adds pixel changes to the same step).
   */
  private restack(label: string, change: (layers: Layer[], active: number) => number, record = true): HistoryEntry {
    this.editor.tool().commit();
    const doc = this.doc;
    const before = [...doc.layers];
    const beforeActive = doc.activeIndex;
    const after = [...doc.layers];
    const afterActive = change(after, beforeActive);
    doc.setStack(after, afterActive);
    const entry: HistoryEntry = {
      label,
      bytes: 64,
      undo: () => doc.setStack(before, beforeActive),
      redo: () => doc.setStack(after, afterActive),
    };
    if (record) this.editor.record(entry);
    return entry;
  }
}
