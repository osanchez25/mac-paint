export type ImageFormat = "png" | "jpeg" | "bmp" | "gif";

export const FORMAT_LABELS: Record<ImageFormat, string> = {
  png: "PNG picture",
  jpeg: "JPEG picture",
  bmp: "BMP picture",
  gif: "GIF picture",
};

export const FORMAT_EXTENSIONS: Record<ImageFormat, string[]> = {
  png: ["png"],
  jpeg: ["jpg", "jpeg"],
  bmp: ["bmp"],
  gif: ["gif"],
};

/** Extensions Paint can open (whatever the system's image decoder reads). */
export const OPENABLE_EXTENSIONS = ["png", "jpg", "jpeg", "bmp", "gif", "tif", "tiff", "heic", "webp", "ico"];

export interface OpenedFile {
  name: string;
  /** Full path, when the platform has one (the Mac app). */
  path: string | null;
  bytes: Uint8Array;
}

/**
 * Everything the editor needs from the outside world. The Mac app uses Tauri;
 * the browser version (handy for development) uses web APIs.
 */
export interface Platform {
  readonly kind: "mac" | "browser";
  pickImageToOpen(): Promise<OpenedFile | null>;
  readPath(path: string): Promise<OpenedFile>;
  /** Asks where to save. Returns a path (Mac) or a file name (browser), or null if cancelled. */
  pickSaveTarget(suggestedName: string, format: ImageFormat): Promise<string | null>;
  /** Whether a save target can be written again later without asking (a real path). */
  canResave(target: string): boolean;
  writeFile(target: string, bytes: Uint8Array): Promise<void>;
  readClipboardImage(): Promise<ImageData | null>;
  writeClipboardImage(img: ImageData): Promise<void>;
  setTitle(title: string): void;
  setFullscreen(on: boolean): Promise<void>;
  /** Images Finder sends ("Open With", "Edit in Paint", Dock icon), now and later. */
  onOpenFiles(cb: (paths: string[]) => void): void;
  /** `canClose` decides whether the window may close (e.g. after asking to save). */
  onCloseRequested(canClose: () => Promise<boolean>): void;
  /** Cmd+Q from the Mac menu bar. */
  onQuitRequested(cb: () => void): void;
  print(): Promise<void>;
  /**
   * Finds the subject of a PNG picture and returns its mask (see core/mask.ts).
   * Throws NoSubjectError when the picture has no clear subject.
   */
  removeBackground(png: Uint8Array): Promise<Uint8Array>;
  /** Closes the window without asking (the app quits with it). */
  closeWindow(): Promise<void>;
}

export class NoSubjectError extends Error {
  constructor() {
    super("Paint couldn't find a person, animal or object to keep in this picture.");
  }
}

export function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

export function formatFromName(name: string): ImageFormat | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  for (const [f, exts] of Object.entries(FORMAT_EXTENSIONS) as [ImageFormat, string[]][]) {
    if (exts.includes(ext)) return f;
  }
  return null;
}

export function withExtension(name: string, format: ImageFormat): string {
  const stem = name.replace(/\.[^./\\]+$/, "");
  return `${stem}.${FORMAT_EXTENSIONS[format][0]}`;
}
