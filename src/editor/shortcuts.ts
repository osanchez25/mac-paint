import type { PaintApp } from "./paint-app";

/**
 * Windows Paint's keyboard shortcuts, with Cmd in place of Ctrl.
 * Returns true when the key was handled.
 */
export function handleShortcut(app: PaintApp, e: KeyboardEvent): boolean {
  const { editor, files, image } = app;
  const mod = e.metaKey || e.ctrlKey;
  const typing = editor.state.textBox !== null;
  const k = e.key.toLowerCase();

  if (mod) {
    // While typing, Cmd+C/V/X/A/Z belong to the text box.
    if (typing && ["c", "v", "x", "a", "z", "y"].includes(k)) return false;
    if (typing && (k === "b" || k === "i" || k === "u")) {
      const key = k === "b" ? "bold" : k === "i" ? "italic" : "underline";
      const t = editor.state.text;
      editor.set({ text: { ...t, [key]: !t[key] } });
      editor.refreshTool();
      return true;
    }
    switch (k) {
      case "n": void files.newPicture(); return true;
      case "o": void files.open(); return true;
      case "s":
        if (e.shiftKey) void files.saveAs("png");
        else void files.save();
        return true;
      case "p": void files.print(); return true;
      case "z":
        if (e.shiftKey) editor.redo();
        else editor.undo();
        return true;
      case "y": editor.redo(); return true;
      case "a": image.selectAll(); return true;
      case "c": void image.copy(); return true;
      case "x":
        if (e.shiftKey) image.crop();
        else void image.cut();
        return true;
      case "v": void image.paste(); return true;
      case "e": editor.set({ dialog: "properties" }); return true;
      case "i":
        if (!e.shiftKey) return false;
        image.invertSelection();
        return true;
      case "w":
        // Cmd+W closes the window (Mac menu); Paint's Ctrl+W opens Resize.
        if (e.metaKey) return false;
        editor.set({ dialog: "resize" });
        return true;
      case "g": editor.set({ view: { ...editor.state.view, gridlines: !editor.state.view.gridlines } }); return true;
      case "=":
      case "+": editor.zoomStep(1); return true;
      case "-": editor.zoomStep(-1); return true;
      case "0": editor.setZoom(1); return true;
      case "9": editor.zoomToFit(); return true;
    }
    return false;
  }

  if (typing) return editor.tool().key?.(e) ?? false;
  if (editor.tool().key?.(e)) return true;

  if ((e.key === "Delete" || e.key === "Backspace") && editor.state.hasSelection) {
    image.deleteSelection();
    return true;
  }
  if (e.key === "F11") {
    void app.toggleFullscreen();
    return true;
  }
  return false;
}
