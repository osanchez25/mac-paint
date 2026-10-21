import { encodeBmp } from "../core/bmp";
import { encodeGif } from "../core/gif";
import type { ImageFormat } from "../platform/platform";
import { createCanvas, ctx2d } from "./document";

/** Decodes any picture the system can read into a canvas. */
export async function decodeImage(bytes: Uint8Array, name: string): Promise<HTMLCanvasElement> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(new Blob([bytes.slice().buffer]));
  } catch (e) {
    throw new Error(`Paint can't read ${name}: it isn't a picture this Mac can open (${String(e)})`);
  }
  const c = createCanvas(bmp.width, bmp.height);
  // Transparent pixels stay transparent (shown as a checkerboard), like Paint.
  ctx2d(c).drawImage(bmp, 0, 0);
  bmp.close();
  return c;
}

/** `quality` (0–1) only matters for JPEG. */
export async function encodeImage(canvas: HTMLCanvasElement, format: ImageFormat, quality = 0.92): Promise<Uint8Array> {
  const pixels = () => ctx2d(canvas).getImageData(0, 0, canvas.width, canvas.height);
  if (format === "bmp") return encodeBmp(pixels());
  if (format === "gif") return encodeGif(pixels());
  // JPEG has no transparency: put the picture on white first (the browser would use black).
  const src = format === "jpeg" ? onWhite(canvas) : canvas;
  const type = format === "png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => src.toBlob(resolve, type, quality));
  if (!blob) throw new Error(`could not encode the picture as ${format.toUpperCase()}`);
  return new Uint8Array(await blob.arrayBuffer());
}

function onWhite(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = createCanvas(src.width, src.height);
  const ctx = ctx2d(c);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(src, 0, 0);
  return c;
}

export function imageDataToCanvas(img: ImageData): HTMLCanvasElement {
  const c = createCanvas(img.width, img.height);
  ctx2d(c).putImageData(img, 0, 0);
  return c;
}
