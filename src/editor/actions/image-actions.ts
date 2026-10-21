import { toCss } from "../../core/color";
import { intersect, pixelBounds } from "../../core/geometry";
import { MAX_SIDE, resizeTarget, skewedSize, type ResizeInput } from "../../core/image-math";
import type { Platform } from "../../platform/platform";
import { applyMask, parseMask } from "../../core/mask";
import { encodeImage, imageDataToCanvas } from "../codecs";
import { createCanvas, ctx2d } from "../document";
import type { Editor } from "../editor";
import type { Selection } from "../selection";
import { messageOf } from "./file-actions";

export type Rotation = 90 | -90 | 180;
export type FlipAxis = "horizontal" | "vertical";

/**
 * Image group and Edit menu commands. Each one acts on the selection when
 * there is one, otherwise on the whole picture, like Paint.
 */
export class ImageActions {
  constructor(private readonly editor: Editor, private readonly selection: Selection, private readonly platform: Platform) {}

  // ---- selection ----------------------------------------------------------

  selectAll(): void {
    const ed = this.editor;
    ed.setTool("select");
    ed.set({ selectMode: "rectangle" });
    this.selection.mark(ed.doc.bounds);
  }

  deleteSelection(): void {
    this.selection.deleteContents();
  }

  invertSelection(): void {
    this.editor.setTool("select");
    this.selection.invert();
  }

  /**
   * Remove background: keeps the main subject (person, animal, object) and
   * makes the rest transparent. Works on the selection, or the whole picture.
   */
  async removeBackground(): Promise<void> {
    const ed = this.editor;
    if (ed.state.busy) return;
    if (!this.selection.active) ed.tool().commit();
    const source = this.selection.pixels() ?? ed.doc.canvas;
    ed.set({ busy: "Removing background" });
    try {
      const mask = parseMask(await this.platform.removeBackground(await encodeImage(source, "png")));
      const cut = (src: HTMLCanvasElement) => {
        const ctx = ctx2d(src);
        const img = ctx.getImageData(0, 0, src.width, src.height);
        applyMask(img, mask);
        ctx.putImageData(img, 0, 0);
        return src;
      };
      if (this.selection.active) {
        this.selection.transform("Remove background", cut);
      } else {
        cut(ed.doc.canvas);
        ed.record(ed.doc.commitRegion("Remove background", ed.doc.bounds));
      }
    } catch (e) {
      ed.showError(messageOf(e));
    } finally {
      ed.set({ busy: null });
    }
  }

  /** Crops every layer to the selection's box. */
  crop(): void {
    const ed = this.editor;
    const box = this.selection.bounds;
    if (!box) return;
    this.selection.commit();
    const r = intersect(pixelBounds(box), ed.doc.bounds);
    if (!r) return;
    const bg = toCss(ed.state.secondary);
    ed.record(
      ed.doc.commitReplace("Crop", r.w, r.h, (ctx, old, i) => {
        if (i === 0) {
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, r.w, r.h);
        }
        ctx.drawImage(old, -r.x, -r.y);
      }),
    );
  }

  // ---- rotate, flip, resize --------------------------------------------------

  rotate(deg: Rotation): void {
    this.transform("Rotate", (src) => rotateCanvas(src, deg));
  }

  flip(axis: FlipAxis): void {
    this.transform("Flip", (src) => {
      const c = createCanvas(src.width, src.height);
      const ctx = ctx2d(c);
      if (axis === "horizontal") ctx.setTransform(-1, 0, 0, 1, src.width, 0);
      else ctx.setTransform(1, 0, 0, -1, 0, src.height);
      ctx.drawImage(src, 0, 0);
      return c;
    });
  }

  /** "Resize and Skew" dialog. Throws with a readable message on impossible sizes. */
  resizeAndSkew(resize: ResizeInput, skewH: number, skewV: number): void {
    const base = this.selection.bounds ?? this.editor.doc.bounds;
    const size = resizeTarget(base.w, base.h, resize);
    const skewed = skewedSize(size.w, size.h, skewH, skewV);
    if (skewed.w > MAX_SIDE || skewed.h > MAX_SIDE) throw new Error(`the skewed picture would be ${skewed.w} × ${skewed.h} px, over the ${MAX_SIDE} px limit`);
    const bg = toCss(this.editor.state.secondary);
    this.transform("Resize", (src, onBottom) => {
      let out = createCanvas(size.w, size.h);
      const ctx = ctx2d(out);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(src, 0, 0, size.w, size.h);
      // Corners uncovered by the skew: color 2 on the bottom layer, clear on upper layers.
      if (skewH !== 0 || skewV !== 0) out = skewCanvas(out, skewH, skewV, onBottom ? bg : null);
      return out;
    });
  }

  /** New canvas size from the canvas handles or Image Properties. The picture keeps its top-left corner. */
  setCanvasSize(w: number, h: number): void {
    w = Math.max(1, Math.min(MAX_SIDE, Math.round(w)));
    h = Math.max(1, Math.min(MAX_SIDE, Math.round(h)));
    const ed = this.editor;
    if (w === ed.doc.width && h === ed.doc.height) return;
    ed.tool().commit();
    const bg = toCss(ed.state.secondary);
    ed.record(
      ed.doc.commitReplace("Resize canvas", w, h, (ctx, old, i) => {
        // New area: color 2 on the bottom layer, transparent on the others.
        if (i === 0) {
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, w, h);
        }
        ctx.drawImage(old, 0, 0);
      }),
    );
  }

  // ---- clipboard ---------------------------------------------------------------

  async copy(): Promise<void> {
    const px = this.selection.pixels();
    if (!px) return;
    try {
      await this.platform.writeClipboardImage(ctx2d(px).getImageData(0, 0, px.width, px.height));
    } catch (e) {
      this.editor.showError(`Could not copy. ${messageOf(e)}`);
    }
  }

  async cut(): Promise<void> {
    if (!this.selection.active) return;
    await this.copy();
    this.selection.deleteContents();
  }

  async paste(): Promise<void> {
    const img = await this.platform.readClipboardImage();
    if (!img) return;
    this.pasteCanvas(imageDataToCanvas(img), "Paste");
  }

  /** Paste from file: the picture comes in as a selection you can move. */
  pasteCanvas(content: HTMLCanvasElement, label: string): void {
    const ed = this.editor;
    ed.tool().commit();
    // Like Paint's "Enlarge" answer: grow the canvas so the pasted picture fits.
    if (content.width > ed.doc.width || content.height > ed.doc.height) {
      this.setCanvasSize(Math.max(content.width, ed.doc.width), Math.max(content.height, ed.doc.height));
    }
    ed.setTool("select");
    const o = ed.viewportOrigin();
    const x = Math.max(0, Math.min(o.x, ed.doc.width - content.width));
    const y = Math.max(0, Math.min(o.y, ed.doc.height - content.height));
    this.selection.place(content, { x, y }, label);
  }

  /** Applies `fn` to the selection, or to every layer. `onBottom` tells whether the pixels belong to the bottom layer. */
  private transform(label: string, fn: (src: HTMLCanvasElement, onBottom: boolean) => HTMLCanvasElement): void {
    const ed = this.editor;
    if (this.selection.active) {
      const onBottom = ed.doc.onBackground;
      this.selection.transform(label, (src) => fn(src, onBottom));
      return;
    }
    ed.tool().commit();
    const outs = ed.doc.layers.map((l, i) => fn(l.canvas, i === 0));
    ed.record(ed.doc.commitReplace(label, outs[0].width, outs[0].height, (ctx, _old, i) => ctx.drawImage(outs[i], 0, 0)));
  }
}

export function rotateCanvas(src: HTMLCanvasElement, deg: Rotation): HTMLCanvasElement {
  const quarter = deg !== 180;
  const c = createCanvas(quarter ? src.height : src.width, quarter ? src.width : src.height);
  const ctx = ctx2d(c);
  if (deg === 90) ctx.setTransform(0, 1, -1, 0, src.height, 0);
  else if (deg === -90) ctx.setTransform(0, -1, 1, 0, 0, src.width);
  else ctx.setTransform(-1, 0, 0, -1, src.width, src.height);
  ctx.drawImage(src, 0, 0);
  return c;
}

/** Skew like Paint: horizontal degrees slant the sides, vertical degrees slant the top and bottom. */
function skewCanvas(src: HTMLCanvasElement, degH: number, degV: number, bg: string | null): HTMLCanvasElement {
  const th = Math.tan((degH * Math.PI) / 180);
  const tv = Math.tan((degV * Math.PI) / 180);
  const size = skewedSize(src.width, src.height, degH, degV);
  const c = createCanvas(size.w, size.h);
  const ctx = ctx2d(c);
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size.w, size.h);
  }
  const ox = th < 0 ? -th * src.height : 0;
  const oy = tv < 0 ? -tv * src.width : 0;
  ctx.setTransform(1, tv, th, 1, ox, oy);
  ctx.drawImage(src, 0, 0);
  return c;
}
