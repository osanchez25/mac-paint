import type { RGBA } from "./color";
import type { Rect } from "./geometry";

export interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * Paint bucket: replaces the 4-connected area of pixels matching the color at (x, y).
 * Like Windows Paint, matching is exact unless `tolerance` (0–255 per channel) is given.
 * Mutates `img` and returns the changed bounds, or null when nothing changed.
 */
export function floodFill(img: Pixels, x: number, y: number, color: RGBA, tolerance = 0): Rect | null {
  const { data, width, height } = img;
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || y < 0 || x >= width || y >= height) return null;

  const start = (y * width + x) * 4;
  const tr = data[start];
  const tg = data[start + 1];
  const tb = data[start + 2];
  const ta = data[start + 3];
  if (tolerance === 0 && tr === color.r && tg === color.g && tb === color.b && ta === color.a) return null;

  const matches = (i: number) =>
    Math.abs(data[i] - tr) <= tolerance &&
    Math.abs(data[i + 1] - tg) <= tolerance &&
    Math.abs(data[i + 2] - tb) <= tolerance &&
    Math.abs(data[i + 3] - ta) <= tolerance;

  const visited = new Uint8Array(width * height);
  let minX = x;
  let maxX = x;
  let minY = y;
  let maxY = y;
  const stack: number[] = [x, y];

  // Scanline fill: walk each run left and right, then queue the rows above and below.
  while (stack.length) {
    const sy = stack.pop()!;
    const sx = stack.pop()!;
    let lx = sx;
    while (lx >= 0 && !visited[sy * width + lx] && matches((sy * width + lx) * 4)) lx--;
    lx++;
    let rx = sx;
    while (rx < width && !visited[sy * width + rx] && matches((sy * width + rx) * 4)) rx++;
    rx--;
    if (rx < lx) continue;

    for (let i = lx; i <= rx; i++) {
      const p = sy * width + i;
      visited[p] = 1;
      const o = p * 4;
      data[o] = color.r;
      data[o + 1] = color.g;
      data[o + 2] = color.b;
      data[o + 3] = color.a;
    }
    minX = Math.min(minX, lx);
    maxX = Math.max(maxX, rx);
    minY = Math.min(minY, sy);
    maxY = Math.max(maxY, sy);

    for (const ny of [sy - 1, sy + 1]) {
      if (ny < 0 || ny >= height) continue;
      let inRun = false;
      for (let i = lx; i <= rx; i++) {
        const p = ny * width + i;
        const ok = !visited[p] && matches(p * 4);
        if (ok && !inRun) {
          stack.push(i, ny);
          inRun = true;
        } else if (!ok) {
          inRun = false;
        }
      }
    }
  }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}
