import type { Pixels } from "./flood-fill";
import type { Rect } from "./geometry";

/** Copies `r` out of `src` into a new w × h RGBA buffer. `r` must lie inside `src`. */
export function copyRegion(src: Pixels, r: Rect): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(r.w * r.h * 4);
  for (let row = 0; row < r.h; row++) {
    const from = ((r.y + row) * src.width + r.x) * 4;
    out.set(src.data.subarray(from, from + r.w * 4), row * r.w * 4);
  }
  return out;
}

/** Writes a w × h RGBA buffer into `dst` at (x, y). The patch must lie inside `dst`. */
export function writeRegion(dst: Pixels, patch: Uint8ClampedArray, r: Rect): void {
  for (let row = 0; row < r.h; row++) {
    const to = ((r.y + row) * dst.width + r.x) * 4;
    dst.data.set(patch.subarray(row * r.w * 4, (row + 1) * r.w * 4), to);
  }
}

/** Makes every pixel equal to `key` fully transparent (Paint's "Transparent selection"). */
export function keyOut(img: Pixels, key: { r: number; g: number; b: number }): void {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] === key.r && d[i + 1] === key.g && d[i + 2] === key.b) d[i + 3] = 0;
  }
}
