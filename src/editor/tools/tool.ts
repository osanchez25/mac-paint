import type { Point } from "../../core/geometry";
import type { ToolId } from "../state";

export interface ToolPointer {
  /** Picture coordinates (fractional; the pixel is the floor). */
  p: Point;
  /** 1 = left button (color 1), 2 = right button (color 2). */
  button: 1 | 2;
  shift: boolean;
  alt: boolean;
  /** Cmd on the Mac (Ctrl in Windows Paint). */
  mod: boolean;
  /** Distance in picture pixels that counts as "on" a handle at the current zoom. */
  tolerance: number;
  /** Second click of a double click. */
  double: boolean;
}

export interface Tool {
  readonly id: ToolId;
  down(e: ToolPointer): void;
  /** Called on every move, pressed or not (hover changes the cursor over handles). */
  move(e: ToolPointer, pressed: boolean): void;
  up(e: ToolPointer): void;
  /** Lay down anything still being edited (shape, selection, text box). */
  commit(): void;
  /** Throw away anything still being edited. Returns true if there was something. */
  cancel(): boolean;
  /** Ribbon settings changed (color, size, outline…): redraw what is being edited. */
  refresh?(): void;
  /** Keys while this tool is active. Return true when handled. */
  key?(e: KeyboardEvent): boolean;
}
