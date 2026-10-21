import type { Pixels } from "./flood-fill";

export interface Mask {
  width: number;
  height: number;
  /** One byte per pixel: 255 = keep, 0 = remove. */
  data: Uint8Array;
}

/** Reads the remove-background helper's output: width, height (UInt32 LE), then the mask bytes. */
export function parseMask(bytes: Uint8Array): Mask {
  if (bytes.length < 8) throw new Error(`the background mask is too short (${bytes.length} bytes)`);
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = v.getUint32(0, true);
  const height = v.getUint32(4, true);
  const expected = 8 + width * height;
  if (bytes.length !== expected) {
    throw new Error(`the background mask for ${width} × ${height} px should be ${expected} bytes, got ${bytes.length}`);
  }
  return { width, height, data: bytes.subarray(8) };
}

/** Makes the background transparent: each pixel's alpha is scaled by the mask. */
export function applyMask(img: Pixels, mask: Mask): void {
  if (img.width !== mask.width || img.height !== mask.height) {
    throw new Error(`mask is ${mask.width} × ${mask.height} px but the picture is ${img.width} × ${img.height} px`);
  }
  const d = img.data;
  for (let i = 0; i < mask.data.length; i++) {
    const o = i * 4 + 3;
    d[o] = Math.round((d[o] * mask.data[i]) / 255);
  }
}
