import { BrowserPlatform } from "./browser-platform";
import type { Platform } from "./platform";
import { TauriPlatform } from "./tauri-platform";

export function detectPlatform(): Platform {
  return "__TAURI_INTERNALS__" in window ? new TauriPlatform() : new BrowserPlatform();
}
