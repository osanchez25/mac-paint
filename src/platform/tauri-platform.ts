import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Image } from "@tauri-apps/api/image";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { readImage, writeImage } from "@tauri-apps/plugin-clipboard-manager";
import { open, save } from "@tauri-apps/plugin-dialog";

import { baseName, FORMAT_EXTENSIONS, FORMAT_LABELS, NoSubjectError, OPENABLE_EXTENSIONS, type ImageFormat, type OpenedFile, type Platform } from "./platform";

export class TauriPlatform implements Platform {
  readonly kind = "mac" as const;

  async pickImageToOpen(): Promise<OpenedFile | null> {
    const path = await open({ multiple: false, directory: false, filters: [{ name: "All Picture Files", extensions: OPENABLE_EXTENSIONS }] });
    return typeof path === "string" ? this.readPath(path) : null;
  }

  async readPath(path: string): Promise<OpenedFile> {
    const buf = await invoke<ArrayBuffer>("read_file", { path });
    return { name: baseName(path), path, bytes: new Uint8Array(buf) };
  }

  async pickSaveTarget(suggestedName: string, format: ImageFormat): Promise<string | null> {
    return save({ defaultPath: suggestedName, filters: [{ name: FORMAT_LABELS[format], extensions: FORMAT_EXTENSIONS[format] }] });
  }

  canResave(): boolean {
    return true;
  }

  async writeFile(target: string, bytes: Uint8Array): Promise<void> {
    await invoke("write_file", bytes, { headers: { path: encodeURIComponent(target) } });
  }

  async readClipboardImage(): Promise<ImageData | null> {
    try {
      const img = await readImage();
      const { width, height } = await img.size();
      const rgba = await img.rgba();
      return new ImageData(new Uint8ClampedArray(rgba), width, height);
    } catch {
      // The clipboard has no image (text, files or nothing): nothing to paste.
      return null;
    }
  }

  async writeClipboardImage(img: ImageData): Promise<void> {
    const image = await Image.new(new Uint8Array(img.data.buffer.slice(0)), img.width, img.height);
    await writeImage(image);
  }

  setTitle(title: string): void {
    void getCurrentWindow().setTitle(title);
  }

  async setFullscreen(on: boolean): Promise<void> {
    await getCurrentWindow().setFullscreen(on);
  }

  onOpenFiles(cb: (paths: string[]) => void): void {
    const drain = async () => {
      const paths = await invoke<string[]>("take_pending_files");
      if (paths.length) cb(paths);
    };
    void listen("open-files", () => void drain());
    void drain();
  }

  onCloseRequested(canClose: () => Promise<boolean>): void {
    void getCurrentWindow().onCloseRequested(async (event) => {
      if (!(await canClose())) event.preventDefault();
    });
  }

  onQuitRequested(cb: () => void): void {
    void listen("quit-requested", () => cb());
  }

  async removeBackground(png: Uint8Array): Promise<Uint8Array> {
    try {
      return new Uint8Array(await invoke<ArrayBuffer>("remove_background", png));
    } catch (e) {
      if (e === "NO_SUBJECT") throw new NoSubjectError();
      throw new Error(String(e));
    }
  }

  async print(): Promise<void> {
    await invoke("print_window");
  }

  async closeWindow(): Promise<void> {
    await getCurrentWindow().destroy();
  }
}
