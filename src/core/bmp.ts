import type { Pixels } from "./flood-fill";

/**
 * 24-bit BMP, the format Windows Paint writes for "BMP picture".
 * Rows are stored bottom-up, BGR, each padded to 4 bytes. Alpha is
 * flattened onto white, like Paint does.
 */
export function encodeBmp(img: Pixels): Uint8Array {
  const { width, height, data } = img;
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const imageSize = rowSize * height;
  const fileSize = 54 + imageSize;
  const out = new Uint8Array(fileSize);
  const v = new DataView(out.buffer);

  out[0] = 0x42; // B
  out[1] = 0x4d; // M
  v.setUint32(2, fileSize, true);
  v.setUint32(10, 54, true); // pixel data offset
  v.setUint32(14, 40, true); // BITMAPINFOHEADER
  v.setInt32(18, width, true);
  v.setInt32(22, height, true);
  v.setUint16(26, 1, true); // planes
  v.setUint16(28, 24, true); // bits per pixel
  v.setUint32(30, 0, true); // BI_RGB
  v.setUint32(34, imageSize, true);
  v.setInt32(38, 3780, true); // 96 DPI in pixels per meter
  v.setInt32(42, 3780, true);

  for (let y = 0; y < height; y++) {
    const row = 54 + (height - 1 - y) * rowSize;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = data[i + 3] / 255;
      const o = row + x * 3;
      out[o] = Math.round(data[i + 2] * a + 255 * (1 - a));
      out[o + 1] = Math.round(data[i + 1] * a + 255 * (1 - a));
      out[o + 2] = Math.round(data[i] * a + 255 * (1 - a));
    }
  }
  return out;
}
