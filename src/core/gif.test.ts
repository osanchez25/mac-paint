import { describe, expect, it } from "vitest";

import { seededRandom } from "./random";
import { encodeGif, lzwEncode, quantize } from "./gif";

/** Reference GIF LZW decoder (spec algorithm), to check the encoder round-trips. */
function lzwDecode(data: Uint8Array, minCode: number, count: number): number[] {
  const clear = 1 << minCode;
  const end = clear + 1;
  let size = minCode + 1;
  let dict: number[][] = [];
  const reset = () => {
    dict = [];
    for (let i = 0; i < clear; i++) dict[i] = [i];
    dict[clear] = [];
    dict[end] = [];
    size = minCode + 1;
  };
  reset();
  let pos = 0;
  const read = () => {
    let v = 0;
    for (let i = 0; i < size; i++, pos++) v |= ((data[pos >> 3] >> (pos & 7)) & 1) << i;
    return v;
  };
  const out: number[] = [];
  let prev: number[] | null = null;
  while (out.length <= count) {
    const code = read();
    if (code === clear) {
      reset();
      prev = null;
      continue;
    }
    if (code === end) break;
    let entry: number[];
    if (prev === null) {
      entry = dict[code];
    } else {
      entry = code < dict.length ? dict[code] : [...prev, prev[0]];
      if (dict.length < 4096) dict.push([...prev, entry[0]]);
    }
    out.push(...entry);
    if (dict.length === 1 << size && size < 12) size++;
    prev = entry;
  }
  return out;
}

describe("GIF", () => {
  it("LZW round-trips long, varied data (including table resets)", () => {
    const rand = seededRandom(5);
    const input = new Uint8Array(120_000);
    for (let i = 0; i < input.length; i++) input[i] = rand() < 0.7 ? Math.floor(rand() * 256) : input[Math.max(0, i - 1)];
    expect(lzwDecode(lzwEncode(input, 8), 8, input.length)).toEqual(Array.from(input));
  });

  it("LZW round-trips small palettes", () => {
    const input = Uint8Array.from([0, 1, 1, 1, 2, 3, 3, 0, 0, 0, 0, 1, 2, 3, 2, 1]);
    expect(lzwDecode(lzwEncode(input, 2), 2, input.length)).toEqual(Array.from(input));
  });

  it("keeps exact colors when there are 256 or fewer", () => {
    const data = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 255, 0, 0, 255, 0, 0, 0, 0]);
    const q = quantize({ data, width: 4, height: 1 });
    expect(q.palette.slice(0, 2)).toEqual([0xff0000, 0x00ff00]);
    expect(Array.from(q.indices)).toEqual([0, 1, 0, 2]);
    expect(q.transparent).toBe(2);
  });

  it("reduces photos to at most 256 colors", () => {
    const rand = seededRandom(9);
    const w = 64;
    const h = 64;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = rand() * 255;
      data[i + 1] = rand() * 255;
      data[i + 2] = rand() * 255;
      data[i + 3] = 255;
    }
    const q = quantize({ data, width: w, height: h });
    expect(q.palette.length).toBeLessThanOrEqual(256);
    expect(q.transparent).toBeNull();
  });

  it("writes a valid GIF89a file", () => {
    const data = new Uint8ClampedArray(2 * 2 * 4).fill(255);
    const gif = encodeGif({ data, width: 2, height: 2 });
    expect(String.fromCharCode(...gif.slice(0, 6))).toBe("GIF89a");
    expect(gif[6] | (gif[7] << 8)).toBe(2);
    expect(gif[gif.length - 1]).toBe(0x3b);
  });
});
