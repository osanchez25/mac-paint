import { describe, expect, it } from "vitest";

import { encodeBmp } from "./bmp";
import { hsvToRgb, parseHex, rgbToHsv, toHex } from "./color";
import { floodFill } from "./flood-fill";
import { dragHandle, linePixels, pointInPolygon, snapAngle45, squareFrom } from "./geometry";
import { History } from "./history";
import { formatBytes, fromPixels, keepRatio, nextZoom, resizeTarget, skewedSize, toPixels } from "./image-math";
import { copyRegion, keyOut, writeRegion } from "./pixels";
import { boxShapePath, flattenPath, SHAPE_KINDS, isBoxShape } from "./shapes";
import { wrapText } from "./text";

function image(w: number, h: number, fill: [number, number, number, number] = [255, 255, 255, 255]) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) data.set(fill, i);
  return { data, width: w, height: h };
}

function px(img: ReturnType<typeof image>, x: number, y: number) {
  const i = (y * img.width + x) * 4;
  return Array.from(img.data.slice(i, i + 4));
}

describe("floodFill", () => {
  it("fills only the connected area of the clicked color", () => {
    const img = image(5, 5);
    // A black vertical wall at x = 2 splits the picture in two.
    for (let y = 0; y < 5; y++) img.data.set([0, 0, 0, 255], (y * 5 + 2) * 4);
    const area = floodFill(img, 0, 0, { r: 255, g: 0, b: 0, a: 255 });
    expect(area).toEqual({ x: 0, y: 0, w: 2, h: 5 });
    expect(px(img, 1, 4)).toEqual([255, 0, 0, 255]);
    expect(px(img, 2, 2)).toEqual([0, 0, 0, 255]);
    expect(px(img, 4, 4)).toEqual([255, 255, 255, 255]);
  });

  it("does nothing when the area already has the color", () => {
    const img = image(3, 3);
    expect(floodFill(img, 1, 1, { r: 255, g: 255, b: 255, a: 255 })).toBeNull();
  });

  it("ignores clicks outside the picture", () => {
    expect(floodFill(image(3, 3), -1, 5, { r: 0, g: 0, b: 0, a: 255 })).toBeNull();
  });

  it("does not leak through diagonal gaps (4-connected, like Paint)", () => {
    const img = image(3, 3);
    img.data.set([0, 0, 0, 255], (0 * 3 + 1) * 4);
    img.data.set([0, 0, 0, 255], (1 * 3 + 0) * 4);
    floodFill(img, 0, 0, { r: 9, g: 9, b: 9, a: 255 });
    expect(px(img, 0, 0)).toEqual([9, 9, 9, 255]);
    expect(px(img, 1, 1)).toEqual([255, 255, 255, 255]);
  });
});

describe("History", () => {
  const entry = (log: string[], name: string, bytes = 1) => ({
    label: name,
    bytes,
    undo: () => log.push(`undo ${name}`),
    redo: () => log.push(`redo ${name}`),
  });

  it("undoes and redoes in order, and a new change clears redo", () => {
    const log: string[] = [];
    const h = new History();
    h.push(entry(log, "a"));
    h.push(entry(log, "b"));
    h.undo();
    h.redo();
    h.undo();
    h.push(entry(log, "c"));
    expect(h.canRedo).toBe(false);
    h.undo();
    h.undo();
    expect(log).toEqual(["undo b", "redo b", "undo b", "undo c", "undo a"]);
    expect(h.canUndo).toBe(false);
  });

  it("forgets the oldest steps when over the memory budget", () => {
    const log: string[] = [];
    const h = new History(10);
    h.push(entry(log, "a", 6));
    h.push(entry(log, "b", 6));
    h.undo();
    expect(h.canUndo).toBe(false);
  });
});

describe("geometry", () => {
  it("Bresenham line includes both ends", () => {
    const pts = linePixels({ x: 0, y: 0 }, { x: 3, y: 1 });
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[pts.length - 1]).toEqual({ x: 3, y: 1 });
    expect(pts).toHaveLength(4);
  });

  it("Shift snaps lines to 45° and boxes to squares", () => {
    expect(snapAngle45({ x: 0, y: 0 }, { x: 10, y: 1 })).toEqual({ x: 10, y: 0 });
    expect(snapAngle45({ x: 0, y: 0 }, { x: 10, y: 9 })).toEqual({ x: 10, y: 10 });
    expect(squareFrom({ x: 0, y: 0 }, { x: -4, y: 10 })).toEqual({ x: -10, y: 10 });
  });

  it("dragging a handle past the opposite side flips the box", () => {
    expect(dragHandle({ x: 0, y: 0, w: 10, h: 10 }, "e", -15, 0, false)).toEqual({ x: -5, y: 0, w: 5, h: 10 });
  });

  it("corner drag with Shift keeps the aspect ratio", () => {
    const r = dragHandle({ x: 0, y: 0, w: 20, h: 10 }, "se", 20, 0, true);
    expect(r.w / r.h).toBeCloseTo(2);
  });

  it("point in polygon", () => {
    const tri = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }];
    expect(pointInPolygon({ x: 2, y: 2 }, tri)).toBe(true);
    expect(pointInPolygon({ x: 8, y: 8 }, tri)).toBe(false);
  });
});

describe("color", () => {
  it("hex round trip", () => {
    expect(toHex(parseHex("#ED1C24")!)).toBe("#ed1c24");
    expect(parseHex("#abc")).toEqual({ r: 170, g: 187, b: 204, a: 255 });
    expect(parseHex("nope")).toBeNull();
  });

  it("HSV round trip keeps the color", () => {
    for (const hex of ["#ff7f27", "#3f48cc", "#22b14c", "#000000", "#ffffff"]) {
      expect(toHex(hsvToRgb(rgbToHsv(parseHex(hex)!)))).toBe(hex);
    }
  });
});

describe("image math", () => {
  it("resize by percent and pixels", () => {
    expect(resizeTarget(200, 100, { by: "percent", horizontal: 50, vertical: 50 })).toEqual({ w: 100, h: 50 });
    expect(resizeTarget(200, 100, { by: "pixels", horizontal: 640, vertical: 480 })).toEqual({ w: 640, h: 480 });
    expect(() => resizeTarget(200, 100, { by: "percent", horizontal: 0, vertical: 50 })).toThrow(/at least 1 px/);
  });

  it("aspect ratio follows the other side", () => {
    expect(keepRatio(200, 100, "pixels", "h", 400)).toBe(200);
    expect(keepRatio(200, 100, "pixels", "v", 25)).toBe(50);
    expect(keepRatio(200, 100, "percent", "h", 30)).toBe(30);
  });

  it("skew grows the picture", () => {
    expect(skewedSize(100, 100, 45, 0)).toEqual({ w: 200, h: 100 });
    expect(skewedSize(100, 50, 0, -45)).toEqual({ w: 100, h: 150 });
  });

  it("units at 96 DPI", () => {
    expect(fromPixels(96, "in")).toBe(1);
    expect(fromPixels(96, "cm")).toBe(2.54);
    expect(toPixels(2.54, "cm")).toBe(96);
  });

  it("zoom steps", () => {
    expect(nextZoom(1, 1)).toBe(1.5);
    expect(nextZoom(1, -1)).toBe(0.75);
    expect(nextZoom(0.9, 1)).toBe(1);
    expect(nextZoom(8, 1)).toBe(8);
  });

  it("file sizes", () => {
    expect(formatBytes(512)).toBe("512B");
    expect(formatBytes(29081)).toBe("28.4KB");
  });
});

describe("BMP", () => {
  it("writes a 24-bit bottom-up BMP with padded rows", () => {
    const img = image(1, 2, [255, 0, 0, 255]);
    img.data.set([0, 0, 255, 255], 0); // top pixel blue
    const bmp = encodeBmp(img);
    expect(String.fromCharCode(bmp[0], bmp[1])).toBe("BM");
    const v = new DataView(bmp.buffer);
    expect(v.getUint32(2, true)).toBe(54 + 2 * 4);
    expect(v.getUint16(28, true)).toBe(24);
    // First stored row is the bottom (red) pixel, as BGR.
    expect(Array.from(bmp.slice(54, 57))).toEqual([0, 0, 255]);
    expect(Array.from(bmp.slice(58, 61))).toEqual([255, 0, 0]);
  });
});

describe("pixels", () => {
  it("copy and write a region", () => {
    const img = image(4, 4);
    img.data.set([1, 2, 3, 255], (1 * 4 + 1) * 4);
    const r = { x: 1, y: 1, w: 2, h: 2 };
    const patch = copyRegion(img, r);
    expect(Array.from(patch.slice(0, 4))).toEqual([1, 2, 3, 255]);
    const dst = image(4, 4, [0, 0, 0, 255]);
    writeRegion(dst, patch, r);
    expect(px(dst, 1, 1)).toEqual([1, 2, 3, 255]);
    expect(px(dst, 0, 0)).toEqual([0, 0, 0, 255]);
  });

  it("transparent selection keys out color 2", () => {
    const img = image(2, 1);
    img.data.set([0, 0, 0, 255], 4);
    keyOut(img, { r: 255, g: 255, b: 255 });
    expect(px(img, 0, 0)[3]).toBe(0);
    expect(px(img, 1, 0)[3]).toBe(255);
  });
});

describe("shapes", () => {
  it("every box shape has an outline inside its box", () => {
    const box = { x: 10, y: 20, w: 100, h: 60 };
    for (const kind of SHAPE_KINDS) {
      if (!isBoxShape(kind)) continue;
      for (const line of flattenPath(boxShapePath(kind, box))) {
        for (const p of line) {
          expect(p.x).toBeGreaterThanOrEqual(box.x - 0.001);
          expect(p.x).toBeLessThanOrEqual(box.x + box.w + 0.001);
          expect(p.y).toBeGreaterThanOrEqual(box.y - 0.001);
          expect(p.y).toBeLessThanOrEqual(box.y + box.h + 0.001);
        }
      }
    }
  });

  it("closed shapes end where they start", () => {
    const [ring] = flattenPath(boxShapePath("star5", { x: 0, y: 0, w: 10, h: 10 }));
    expect(ring[ring.length - 1]).toEqual(ring[0]);
  });
});

describe("wrapText", () => {
  const measure = (s: string) => s.length * 10;

  it("wraps at spaces and keeps line breaks", () => {
    expect(wrapText("hello big world\nok", 100, measure)).toEqual(["hello big", "world", "ok"]);
  });

  it("breaks a word longer than the box", () => {
    expect(wrapText("abcdefghijkl", 50, measure)).toEqual(["abcde", "fghij", "kl"]);
  });

  it("keeps empty lines", () => {
    expect(wrapText("a\n\nb", 100, measure)).toEqual(["a", "", "b"]);
  });
});

describe("remove background mask", () => {
  it("parses the helper output and scales alpha", async () => {
    const { parseMask, applyMask } = await import("./mask");
    const raw = new Uint8Array([2, 0, 0, 0, 1, 0, 0, 0, 255, 0]);
    const mask = parseMask(raw);
    expect(mask).toMatchObject({ width: 2, height: 1 });
    const img = image(2, 1);
    applyMask(img, mask);
    expect(px(img, 0, 0)[3]).toBe(255);
    expect(px(img, 1, 0)[3]).toBe(0);
  });

  it("refuses a mask of the wrong size", async () => {
    const { parseMask, applyMask } = await import("./mask");
    expect(() => parseMask(new Uint8Array([2, 0, 0, 0, 2, 0, 0, 0, 1]))).toThrow(/should be 12 bytes/);
    const mask = parseMask(new Uint8Array([1, 0, 0, 0, 1, 0, 0, 0, 9]));
    expect(() => applyMask(image(2, 2), mask)).toThrow(/mask is 1 × 1/);
  });
});

describe("save a smaller copy", () => {
  it("names, sizes and savings", async () => {
    const c = await import("./compress");
    expect(c.smallerName("photo.png")).toBe("photo-small.jpg");
    expect(c.smallerName("Untitled")).toBe("Untitled-small.jpg");
    expect(c.scaledSize(1000, 501, 50)).toEqual({ w: 500, h: 251 });
    expect(c.scaledSize(3, 3, 25)).toEqual({ w: 1, h: 1 });
    expect(c.savings(1000, 250)).toBe("75% smaller");
    expect(c.savings(1000, 1200)).toBeNull();
    expect(c.savings(1_800_000, 4300)).toBe("99% smaller");
    expect(c.qualityOf("low")).toBe(0.5);
  });

  it("detects transparency", async () => {
    const { hasTransparency } = await import("./compress");
    expect(hasTransparency(new Uint8ClampedArray([1, 2, 3, 255]))).toBe(false);
    expect(hasTransparency(new Uint8ClampedArray([1, 2, 3, 255, 0, 0, 0, 10]))).toBe(true);
  });
});
