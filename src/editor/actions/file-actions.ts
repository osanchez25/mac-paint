import { qualityOf, scaledSize, smallerName, type QualityId } from "../../core/compress";
import { formatBytes } from "../../core/image-math";
import { baseName, formatFromName, withExtension, type ImageFormat, type OpenedFile, type Platform } from "../../platform/platform";
import { decodeImage, encodeImage } from "../codecs";
import { createCanvas, ctx2d } from "../document";
import type { Editor } from "../editor";
import { DEFAULT_HEIGHT, DEFAULT_WIDTH } from "../state";

export type UnsavedChoice = "save" | "discard" | "cancel";

/** New, Open, Save, Save as, Print and the "save your changes?" question. */
export class FileActions {
  private unsavedResolver: ((c: UnsavedChoice) => void) | null = null;

  constructor(private readonly editor: Editor, private readonly platform: Platform) {}

  async newPicture(): Promise<void> {
    if (!(await this.confirmDiscard())) return;
    this.editor.load(null, DEFAULT_WIDTH, DEFAULT_HEIGHT, { name: "Untitled", path: null, bytes: null });
  }

  async open(): Promise<void> {
    if (!(await this.confirmDiscard())) return;
    await this.guard(async () => {
      const file = await this.platform.pickImageToOpen();
      if (file) await this.load(file);
    });
  }

  /** Finder "Open With" / "Edit in Paint". Only the first picture opens; Paint is one picture per window. */
  async openPaths(paths: string[]): Promise<void> {
    if (!paths.length || !(await this.confirmDiscard())) return;
    await this.guard(async () => this.load(await this.platform.readPath(paths[0])));
  }

  /** A picture file dropped on the window. */
  async openDropped(file: File): Promise<void> {
    if (!(await this.confirmDiscard())) return;
    await this.guard(async () => this.load({ name: file.name, path: null, bytes: new Uint8Array(await file.arrayBuffer()) }));
  }

  /** Cmd+S: writes over the opened file, or asks where to save a new one. */
  async save(): Promise<boolean> {
    const { file } = this.editor.state;
    const format = formatFromName(file.name);
    if (file.path && format && this.platform.canResave(file.path)) return this.writeTo(file.path, format);
    return this.saveAs(format ?? "png");
  }

  async saveAs(format: ImageFormat): Promise<boolean> {
    const name = withExtension(this.editor.state.file.name, format);
    let ok = false;
    await this.guard(async () => {
      const target = await this.platform.pickSaveTarget(name, format);
      if (!target) return;
      ok = await this.writeTo(target, formatFromName(target) ?? format);
    });
    return ok;
  }

  /** A smaller JPEG of the picture (lower quality and/or fewer pixels). The open picture is not changed. */
  async encodeSmaller(quality: QualityId, percent: number): Promise<Uint8Array> {
    const flat = this.editor.doc.flatten();
    const size = scaledSize(flat.width, flat.height, percent);
    let src = flat;
    if (size.w !== flat.width || size.h !== flat.height) {
      src = createCanvas(size.w, size.h);
      const ctx = ctx2d(src);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(flat, 0, 0, size.w, size.h);
    }
    return encodeImage(src, "jpeg", qualityOf(quality));
  }

  /** "Save a smaller copy": asks where, writes the JPEG, and leaves the open file as it is. */
  async saveSmaller(quality: QualityId, percent: number): Promise<boolean> {
    this.editor.tool().commit();
    try {
      const target = await this.platform.pickSaveTarget(smallerName(this.editor.state.file.name), "jpeg");
      if (!target) return false;
      const bytes = await this.encodeSmaller(quality, percent);
      await this.platform.writeFile(target, bytes);
      this.editor.showSuccess(`Saved a smaller copy: ${baseName(target)} (${formatBytes(bytes.byteLength)}).`);
      return true;
    } catch (e) {
      this.editor.showError(`Could not save the smaller copy. ${messageOf(e)}`);
      return false;
    }
  }

  /** Prints only the picture: a copy goes in #print-area, which the print styles show alone. */
  async print(): Promise<void> {
    this.editor.tool().commit();
    await this.guard(async () => {
      const area = document.getElementById("print-area");
      if (!area) throw new Error("the print area is missing from the page");
      const img = new Image();
      img.src = this.editor.doc.flatten().toDataURL("image/png");
      await img.decode();
      area.replaceChildren(img);
      try {
        await this.platform.print();
      } finally {
        // The print dialog may still be reading the page; clear it a moment later.
        setTimeout(() => area.replaceChildren(), 1000);
      }
    });
  }

  /**
   * Before throwing away unsaved changes, asks like Paint does:
   * Save / Don't save / Cancel. Resolves true when it is fine to continue.
   */
  async confirmDiscard(): Promise<boolean> {
    this.editor.tool().commit();
    if (!this.editor.state.dirty) return true;
    const choice = await new Promise<UnsavedChoice>((resolve) => {
      this.unsavedResolver = resolve;
      this.editor.set({ dialog: "unsaved" });
    });
    if (choice === "cancel") return false;
    if (choice === "discard") return true;
    return this.save();
  }

  /** Called by the unsaved-changes dialog. */
  answerUnsaved(choice: UnsavedChoice): void {
    this.editor.set({ dialog: null });
    this.unsavedResolver?.(choice);
    this.unsavedResolver = null;
  }

  private async load(file: OpenedFile): Promise<void> {
    const canvas = await decodeImage(file.bytes, file.name);
    this.editor.load(canvas, canvas.width, canvas.height, { name: file.name, path: file.path, bytes: file.bytes.byteLength });
    this.editor.zoomToFit();
  }

  private async writeTo(target: string, format: ImageFormat): Promise<boolean> {
    this.editor.tool().commit();
    try {
      // Files hold one flat picture, like Paint: the visible layers are merged on save.
      const bytes = await encodeImage(this.editor.doc.flatten(), format);
      await this.platform.writeFile(target, bytes);
      const canResave = this.platform.canResave(target);
      this.editor.set({
        file: { name: target.split(/[\\/]/).pop() ?? target, path: canResave ? target : null, bytes: bytes.byteLength },
        dirty: false,
      });
      return true;
    } catch (e) {
      this.editor.showError(`Could not save the picture. ${messageOf(e)}`);
      return false;
    }
  }

  private async guard(fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (e) {
      this.editor.showError(messageOf(e));
    }
  }
}

export function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
