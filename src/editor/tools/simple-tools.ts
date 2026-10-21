import { floodFill } from "../../core/flood-fill";
import type { Editor } from "../editor";
import type { Tool, ToolPointer } from "./tool";

/** Paint bucket: fills the touching area of the same color with color 1 (left) or color 2 (right). */
export class FillTool implements Tool {
  readonly id = "fill" as const;
  constructor(private readonly editor: Editor) {}

  down(e: ToolPointer): void {
    const { doc } = this.editor;
    const img = doc.imageData();
    const area = floodFill(img, e.p.x, e.p.y, this.editor.colorFor(e.button));
    if (!area) return;
    doc.ctx.putImageData(img, 0, 0, area.x, area.y, area.w, area.h);
    this.editor.record(doc.commitRegion("Fill", area));
  }

  move(): void {}
  up(): void {}
  commit(): void {}
  cancel(): boolean {
    return false;
  }
}

/** Color picker: left click sets color 1, right click color 2, then goes back to the previous tool. */
export class PickerTool implements Tool {
  readonly id = "picker" as const;
  constructor(private readonly editor: Editor) {}

  down(e: ToolPointer): void {
    const c = this.editor.doc.colorAt(e.p.x, e.p.y);
    if (!c) return;
    this.editor.setColor(e.button, { ...c, a: 255 });
  }

  up(): void {
    this.editor.returnFromPicker();
  }

  move(): void {}
  commit(): void {}
  cancel(): boolean {
    return false;
  }
}

/** Magnifier: left click zooms in on the point, right click zooms out. */
export class MagnifierTool implements Tool {
  readonly id = "magnifier" as const;
  constructor(private readonly editor: Editor) {}

  down(e: ToolPointer): void {
    this.editor.zoomStep(e.button === 1 && !e.alt ? 1 : -1, e.p);
  }

  move(e: ToolPointer): void {
    this.editor.set({ cursor: e.alt ? "zoom-out" : "tool" });
  }

  up(): void {}
  commit(): void {}
  cancel(): boolean {
    return false;
  }
}
