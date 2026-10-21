import { OPENABLE_EXTENSIONS, type ImageFormat, type OpenedFile, type Platform } from "./platform";

/** Runs Paint in a normal browser tab (development and testing). */
export class BrowserPlatform implements Platform {
  readonly kind = "browser" as const;

  pickImageToOpen(): Promise<OpenedFile | null> {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = OPENABLE_EXTENSIONS.map((e) => `.${e}`).join(",");
      input.onchange = async () => {
        const f = input.files?.[0];
        resolve(f ? { name: f.name, path: null, bytes: new Uint8Array(await f.arrayBuffer()) } : null);
      };
      input.oncancel = () => resolve(null);
      input.click();
    });
  }

  readPath(path: string): Promise<OpenedFile> {
    return Promise.reject(new Error(`the browser version cannot open ${path} by path`));
  }

  async pickSaveTarget(suggestedName: string, _format: ImageFormat): Promise<string | null> {
    return suggestedName;
  }

  canResave(): boolean {
    return false;
  }

  async writeFile(target: string, bytes: Uint8Array): Promise<void> {
    const url = URL.createObjectURL(new Blob([bytes.slice().buffer]));
    const a = document.createElement("a");
    a.href = url;
    a.download = target;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async readClipboardImage(): Promise<ImageData | null> {
    try {
      for (const item of await navigator.clipboard.read()) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (!type) continue;
        const bmp = await createImageBitmap(await item.getType(type));
        const c = new OffscreenCanvas(bmp.width, bmp.height);
        const ctx = c.getContext("2d")!;
        ctx.drawImage(bmp, 0, 0);
        return ctx.getImageData(0, 0, bmp.width, bmp.height);
      }
    } catch {
      // Clipboard access denied or empty.
    }
    return null;
  }

  async writeClipboardImage(img: ImageData): Promise<void> {
    const c = new OffscreenCanvas(img.width, img.height);
    c.getContext("2d")!.putImageData(img, 0, 0);
    const blob = await c.convertToBlob({ type: "image/png" });
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  }

  setTitle(title: string): void {
    document.title = title;
  }

  async setFullscreen(on: boolean): Promise<void> {
    if (on) await document.documentElement.requestFullscreen?.();
    else if (document.fullscreenElement) await document.exitFullscreen();
  }

  onOpenFiles(): void {}

  onCloseRequested(): void {}

  onQuitRequested(): void {}

  async removeBackground(): Promise<Uint8Array> {
    throw new Error("Remove background uses the Mac's subject detection, so it only works in the Mac app.");
  }

  async print(): Promise<void> {
    window.print();
  }

  async closeWindow(): Promise<void> {
    window.close();
  }
}
