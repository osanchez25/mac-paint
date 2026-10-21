import type { BrushKind, ToolId } from "../../editor/state";

/** The editor asks for this when the tool's own cursor should show. */
export const TOOL_CURSOR = "tool";

const svgCursor = (svg: string, x: number, y: number, fallback: string) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") ${x} ${y}, ${fallback}`;

const PENCIL = svgCursor(
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M3 21l1.2-4.6L16.6 4a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L7.6 19.8z" fill="#fff" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/><path d="M3 21l1.2-4.6 3.4 3.4z" fill="#000"/></svg>`,
  3, 21, "crosshair",
);

const BUCKET = svgCursor(
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M10 3l8 8-7 7-8-8z" fill="#fff" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/><path d="M18 11c1.5 2 2.5 3.5 2.5 4.6a1.6 1.6 0 0 1-3.2 0c0-1.1.7-2.6.7-4.6z" fill="#000"/><path d="M2 22l3-3" stroke="#000" stroke-width="1.4"/></svg>`,
  2, 22, "crosshair",
);

const DROPPER = svgCursor(
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M14.5 6.5l3 3L7 20l-3.6.6L4 17z" fill="#fff" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/><path d="M13 5l6 6 1.6-1.6a2.8 2.8 0 0 0-4-4z" fill="#000"/></svg>`,
  3, 21, "crosshair",
);

/** Outline of the brush tip at its real size on screen (circle), or the eraser (square). */
function tipCursor(sizePx: number, square: boolean): string {
  const s = Math.max(5, Math.min(120, Math.round(sizePx)));
  const box = s + 4;
  const c = box / 2;
  const shape = square
    ? `<rect x="${c - s / 2}" y="${c - s / 2}" width="${s}" height="${s}"`
    : `<circle cx="${c}" cy="${c}" r="${s / 2}"`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${box}" height="${box}">${shape} fill="none" stroke="#fff" stroke-width="2.5"/>${shape} fill="${square ? "#fff" : "none"}" fill-opacity="0.35" stroke="#000" stroke-width="1"/></svg>`;
  return svgCursor(svg, Math.round(c), Math.round(c), "crosshair");
}

/** CSS cursor for the canvas: the tool's own cursor, sized to the tip like Paint. */
export function cssCursor(requested: string, tool: ToolId, brush: BrushKind, size: number, zoom: number): string {
  if (requested !== TOOL_CURSOR) return requested;
  switch (tool) {
    case "pencil":
      return PENCIL;
    case "fill":
      return BUCKET;
    case "picker":
      return DROPPER;
    case "eraser":
      return tipCursor(size * zoom, true);
    case "brush":
      return brush === "airbrush" ? tipCursor(size * 5 * zoom, false) : size * zoom < 5 ? "crosshair" : tipCursor(size * zoom, false);
    case "text":
      return "text";
    case "magnifier":
      return "zoom-in";
    default:
      return "crosshair";
  }
}
