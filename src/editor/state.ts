import { BLACK, CUSTOM_SLOTS, WHITE, type RGBA } from "../core/color";
import type { Point, Rect } from "../core/geometry";
import type { ShapeKind } from "../core/shapes";

export type ToolId = "select" | "pencil" | "fill" | "text" | "eraser" | "picker" | "magnifier" | "brush" | "shape";

export type SelectMode = "rectangle" | "freeform";

export const BRUSH_KINDS = [
  "brush",
  "calligraphyBrush",
  "calligraphyPen",
  "airbrush",
  "oil",
  "crayon",
  "marker",
  "naturalPencil",
  "watercolor",
] as const;

export type BrushKind = (typeof BRUSH_KINDS)[number];

export const BRUSH_LABELS: Record<BrushKind, string> = {
  brush: "Brush",
  calligraphyBrush: "Calligraphy brush",
  calligraphyPen: "Calligraphy pen",
  airbrush: "Airbrush",
  oil: "Oil brush",
  crayon: "Crayon",
  marker: "Marker",
  naturalPencil: "Natural pencil",
  watercolor: "Watercolor brush",
};

/** Shape outlines can be solid or drawn with one of the textured brushes, like in Paint. */
export type OutlineStyle = "none" | "solid" | "crayon" | "marker" | "oil" | "naturalPencil" | "watercolor";
export type FillStyle = "none" | "solid";

export type SizeGroup = "pencil" | "brush" | "eraser" | "shape" | "select";

export interface TextStyle {
  font: string;
  size: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  /** Opaque = the box is filled with color 2 behind the text. */
  opaque: boolean;
}

export type Overlay =
  /** Dashed box with resize handles: a selection, or a shape still being edited. */
  | { kind: "box"; rect: Rect; handles: boolean; outlines?: Point[][] }
  /** Free-form selection outline while it is drawn. */
  | { kind: "lasso"; points: Point[] }
  /** Dashed outline of the new canvas size while dragging the canvas handles. */
  | { kind: "canvasSize"; w: number; h: number };

export interface TextBox {
  rect: Rect;
  value: string;
}

export interface FileInfo {
  name: string;
  /** Where the picture was opened from or last saved to. Null for a new picture. */
  path: string | null;
  bytes: number | null;
}

export type DialogId = "resize" | "properties" | "editColors" | "unsaved" | "about" | "saveSmaller" | null;

export interface LayerInfo {
  id: string;
  name: string;
  visible: boolean;
}

export interface Message {
  intent: "error" | "success";
  text: string;
}

export interface ViewOptions {
  gridlines: boolean;
  statusBar: boolean;
  fullscreen: boolean;
}

export interface EditorState {
  width: number;
  height: number;
  zoom: number;
  tool: ToolId;
  selectMode: SelectMode;
  transparentSelection: boolean;
  brush: BrushKind;
  shape: ShapeKind;
  outline: OutlineStyle;
  fill: FillStyle;
  sizes: Record<SizeGroup, number>;
  primary: RGBA;
  secondary: RGBA;
  activeSlot: 1 | 2;
  customColors: (string | null)[];
  text: TextStyle;
  textBox: TextBox | null;
  overlay: Overlay | null;
  /** Something is selected (or a shape is being edited), so Image tools act on it. */
  hasSelection: boolean;
  /** A shape is drawn and can still be moved or resized: shows the shape options. */
  editingShape: boolean;
  cursorPos: Point | null;
  selectionSize: { w: number; h: number } | null;
  cursor: string;
  canUndo: boolean;
  canRedo: boolean;
  file: FileInfo;
  dirty: boolean;
  view: ViewOptions;
  dialog: DialogId;
  /** Short message shown in a toast: a failed save, or "Saved a smaller copy". */
  message: Message | null;
  /** Bottom layer first, like the document. */
  layers: LayerInfo[];
  activeLayer: string;
  layersPanel: boolean;
  /** Goes up whenever pixels are committed, so layer thumbnails know to redraw. */
  pixelsVersion: number;
  /** A slow command is running (shown over the canvas), e.g. "Removing background". */
  busy: string | null;
}

export const DEFAULT_WIDTH = 1152;
export const DEFAULT_HEIGHT = 648;

export function initialState(): EditorState {
  return {
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    zoom: 1,
    tool: "pencil",
    selectMode: "rectangle",
    transparentSelection: false,
    brush: "brush",
    shape: "rectangle",
    outline: "solid",
    fill: "none",
    sizes: { pencil: 1, brush: 5, eraser: 8, shape: 3, select: 1 },
    primary: BLACK,
    secondary: WHITE,
    activeSlot: 1,
    customColors: Array<string | null>(CUSTOM_SLOTS).fill(null),
    text: { font: "Arial", size: 11, bold: false, italic: false, underline: false, strike: false, opaque: false },
    textBox: null,
    overlay: null,
    hasSelection: false,
    editingShape: false,
    cursorPos: null,
    selectionSize: null,
    cursor: "default",
    canUndo: false,
    canRedo: false,
    file: { name: "Untitled", path: null, bytes: null },
    dirty: false,
    view: { gridlines: false, statusBar: true, fullscreen: false },
    dialog: null,
    message: null,
    busy: null,
    layers: [],
    activeLayer: "",
    layersPanel: false,
    pixelsVersion: 0,
  };
}

export function sizeGroupOf(state: Pick<EditorState, "tool">): SizeGroup {
  switch (state.tool) {
    case "pencil": return "pencil";
    case "eraser": return "eraser";
    case "shape": return "shape";
    case "brush": return "brush";
    default: return "select";
  }
}

/** Size choices offered in the Size dropdown, per tool (Paint offers four presets plus a slider). */
export const SIZE_PRESETS: Record<SizeGroup, readonly number[]> = {
  pencil: [1, 2, 3, 4],
  brush: [1, 3, 5, 8],
  eraser: [4, 8, 12, 16],
  shape: [1, 3, 5, 8],
  select: [1],
};
