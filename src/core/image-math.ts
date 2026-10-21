/** Paint's limit for a picture side; bigger canvases make the app unusable. */
export const MAX_SIDE = 30000;

export type ResizeBy = "percent" | "pixels";

export interface ResizeInput {
  by: ResizeBy;
  horizontal: number;
  vertical: number;
}

/** Target size for the "Resize and Skew" dialog. Throws on sizes Paint would refuse. */
export function resizeTarget(w: number, h: number, input: ResizeInput): { w: number; h: number } {
  const nw = input.by === "percent" ? Math.round((w * input.horizontal) / 100) : Math.round(input.horizontal);
  const nh = input.by === "percent" ? Math.round((h * input.vertical) / 100) : Math.round(input.vertical);
  if (!Number.isFinite(nw) || !Number.isFinite(nh) || nw < 1 || nh < 1) {
    throw new Error(`resize to ${nw} × ${nh} px is not possible: each side must be at least 1 px`);
  }
  if (nw > MAX_SIDE || nh > MAX_SIDE) {
    throw new Error(`resize to ${nw} × ${nh} px is too big: the limit is ${MAX_SIDE} px per side`);
  }
  return { w: nw, h: nh };
}

/** With "Maintain aspect ratio" on, typing one side computes the other. */
export function keepRatio(w: number, h: number, by: ResizeBy, changed: "h" | "v", value: number): number {
  if (by === "percent") return value;
  return changed === "h" ? Math.round((value * h) / w) : Math.round((value * w) / h);
}

/** Size of a w × h picture after skewing by the given degrees (−89…89). */
export function skewedSize(w: number, h: number, degH: number, degV: number): { w: number; h: number } {
  const th = Math.tan((degH * Math.PI) / 180);
  const tv = Math.tan((degV * Math.PI) / 180);
  return { w: Math.round(w + Math.abs(h * th)), h: Math.round(h + Math.abs(w * tv)) };
}

export type Unit = "px" | "in" | "cm";

/** Paint's Image Properties assume 96 DPI. */
export const DPI = 96;

export function fromPixels(px: number, unit: Unit): number {
  if (unit === "px") return px;
  const inches = px / DPI;
  return unit === "in" ? round2(inches) : round2(inches * 2.54);
}

export function toPixels(value: number, unit: Unit): number {
  if (unit === "px") return Math.round(value);
  const inches = unit === "in" ? value : value / 2.54;
  return Math.round(inches * DPI);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** "28.4KB" style sizes for the status bar. */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / (1024 * 1024)).toFixed(1)}MB`;
}

/** Zoom steps Paint walks through with zoom in / zoom out. */
export const ZOOM_STEPS = [0.125, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 5, 6, 7, 8] as const;

export function nextZoom(current: number, dir: 1 | -1): number {
  if (dir > 0) return ZOOM_STEPS.find((z) => z > current + 1e-6) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1];
  for (let i = ZOOM_STEPS.length - 1; i >= 0; i--) if (ZOOM_STEPS[i] < current - 1e-6) return ZOOM_STEPS[i];
  return ZOOM_STEPS[0];
}

export function clampZoom(z: number): number {
  return Math.min(ZOOM_STEPS[ZOOM_STEPS.length - 1], Math.max(ZOOM_STEPS[0], z));
}
