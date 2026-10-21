import type { Pixels } from "./flood-fill";

/**
 * GIF89a writer, for "Save as > GIF picture". GIF holds at most 256 colors:
 * a drawing with fewer keeps its exact colors; a photo is reduced with
 * median cut (like Paint, the result can look banded). Pixels less than half
 * opaque become GIF's single transparent color.
 */
export function encodeGif(img: Pixels): Uint8Array {
  const { width, height } = img;
  const { palette, indices, transparent } = quantize(img);
  const bits = Math.max(1, Math.ceil(Math.log2(Math.max(2, palette.length))));
  const tableSize = 1 << bits;
  const out = new ByteWriter();

  out.ascii("GIF89a");
  out.u16(width);
  out.u16(height);
  out.u8(0x80 | (7 << 4) | (bits - 1)); // global color table, 8-bit color resolution
  out.u8(0); // background color index
  out.u8(0); // pixel aspect ratio
  for (let i = 0; i < tableSize; i++) {
    const c = palette[i] ?? 0;
    out.u8((c >> 16) & 255);
    out.u8((c >> 8) & 255);
    out.u8(c & 255);
  }
  if (transparent !== null) {
    out.bytes([0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, transparent, 0x00]);
  }
  out.u8(0x2c); // image descriptor
  out.u16(0);
  out.u16(0);
  out.u16(width);
  out.u16(height);
  out.u8(0);

  const minCode = Math.max(2, bits);
  out.u8(minCode);
  const data = lzwEncode(indices, minCode);
  for (let i = 0; i < data.length; i += 255) {
    const block = data.subarray(i, i + 255);
    out.u8(block.length);
    out.bytes(block);
  }
  out.u8(0);
  out.u8(0x3b); // trailer
  return out.result();
}

interface Quantized {
  /** 0xRRGGBB colors. */
  palette: number[];
  indices: Uint8Array;
  transparent: number | null;
}

export function quantize(img: Pixels, maxColors = 256): Quantized {
  const { data } = img;
  const n = img.width * img.height;
  const counts = new Map<number, number>();
  let hasTransparent = false;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (data[o + 3] < 128) {
      hasTransparent = true;
      continue;
    }
    const c = (data[o] << 16) | (data[o + 1] << 8) | data[o + 2];
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  const limit = hasTransparent ? maxColors - 1 : maxColors;
  const palette = counts.size <= limit ? [...counts.keys()] : medianCut(counts, limit);
  if (palette.length === 0) palette.push(0);
  const transparent = hasTransparent ? palette.length : null;

  const exact = new Map<number, number>();
  palette.forEach((c, i) => exact.set(c, i));
  const indices = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (data[o + 3] < 128) {
      indices[i] = transparent!;
      continue;
    }
    const c = (data[o] << 16) | (data[o + 1] << 8) | data[o + 2];
    let idx = exact.get(c);
    if (idx === undefined) {
      idx = nearest(palette, c);
      exact.set(c, idx);
    }
    indices[i] = idx;
  }
  return { palette: transparent === null ? palette : [...palette, 0], indices, transparent };
}

function nearest(palette: readonly number[], c: number): number {
  const r = (c >> 16) & 255;
  const g = (c >> 8) & 255;
  const b = c & 255;
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const p = palette[i];
    const dr = ((p >> 16) & 255) - r;
    const dg = ((p >> 8) & 255) - g;
    const db = (p & 255) - b;
    const d = dr * dr * 2 + dg * dg * 4 + db * db * 3;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Splits the color cube until there are `k` boxes; each box's weighted average is a palette color. */
function medianCut(counts: Map<number, number>, k: number): number[] {
  type Box = { colors: [number, number][] };
  const channel = (c: number, ch: number) => (c >> (16 - ch * 8)) & 255;
  const range = (b: Box, ch: number) => {
    let lo = 255;
    let hi = 0;
    for (const [c] of b.colors) {
      const v = channel(c, ch);
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    return hi - lo;
  };
  const boxes: Box[] = [{ colors: [...counts.entries()] }];
  while (boxes.length < k) {
    let pick = -1;
    let pickScore = 0;
    let pickCh = 0;
    boxes.forEach((b, i) => {
      if (b.colors.length < 2) return;
      for (let ch = 0; ch < 3; ch++) {
        const score = range(b, ch) * Math.sqrt(b.colors.length);
        if (score > pickScore) {
          pickScore = score;
          pick = i;
          pickCh = ch;
        }
      }
    });
    if (pick < 0) break;
    const box = boxes[pick];
    box.colors.sort((a, b) => channel(a[0], pickCh) - channel(b[0], pickCh));
    const total = box.colors.reduce((s, [, n]) => s + n, 0);
    let acc = 0;
    let cut = 1;
    for (let i = 0; i < box.colors.length - 1; i++) {
      acc += box.colors[i][1];
      if (acc >= total / 2) {
        cut = i + 1;
        break;
      }
    }
    boxes.splice(pick, 1, { colors: box.colors.slice(0, cut) }, { colors: box.colors.slice(cut) });
  }
  return boxes.map((b) => {
    let r = 0;
    let g = 0;
    let bl = 0;
    let n = 0;
    for (const [c, w] of b.colors) {
      r += ((c >> 16) & 255) * w;
      g += ((c >> 8) & 255) * w;
      bl += (c & 255) * w;
      n += w;
    }
    return (Math.round(r / n) << 16) | (Math.round(g / n) << 8) | Math.round(bl / n);
  });
}

/** GIF's variable-width LZW, codes packed least-significant bit first. */
export function lzwEncode(indices: Uint8Array, minCode: number): Uint8Array {
  const clear = 1 << minCode;
  const end = clear + 1;
  const bits = new BitWriter();
  let size = minCode + 1;
  let next = end + 1;
  let dict = new Map<number, number>();

  bits.write(clear, size);
  if (indices.length === 0) {
    bits.write(end, size);
    return bits.result();
  }
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = prefix * 4096 + k;
    const found = dict.get(key);
    if (found !== undefined) {
      prefix = found;
      continue;
    }
    bits.write(prefix, size);
    if (next < 4096) {
      dict.set(key, next++);
      if (next > 1 << size && size < 12) size++;
    } else {
      // Table full: start over, like every GIF encoder.
      bits.write(clear, size);
      dict = new Map();
      size = minCode + 1;
      next = end + 1;
    }
    prefix = k;
  }
  bits.write(prefix, size);
  bits.write(end, size);
  return bits.result();
}

class BitWriter {
  private buf: number[] = [];
  private cur = 0;
  private used = 0;
  write(code: number, size: number): void {
    this.cur |= code << this.used;
    this.used += size;
    while (this.used >= 8) {
      this.buf.push(this.cur & 255);
      this.cur >>>= 8;
      this.used -= 8;
    }
  }
  result(): Uint8Array {
    if (this.used > 0) this.buf.push(this.cur & 255);
    return Uint8Array.from(this.buf);
  }
}

class ByteWriter {
  private buf: number[] = [];
  u8(v: number): void {
    this.buf.push(v & 255);
  }
  u16(v: number): void {
    this.buf.push(v & 255, (v >> 8) & 255);
  }
  ascii(s: string): void {
    for (const ch of s) this.buf.push(ch.charCodeAt(0));
  }
  bytes(b: ArrayLike<number>): void {
    for (let i = 0; i < b.length; i++) this.buf.push(b[i]);
  }
  result(): Uint8Array {
    return Uint8Array.from(this.buf);
  }
}
