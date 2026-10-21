import { useEffect } from "react";

import { handleShortcut } from "../editor/shortcuts";
import { usePaint, useEditor } from "./app-context";
import { CanvasView } from "./canvas/CanvasView";
import { Dialogs } from "./dialogs/Dialogs";
import { BusyOverlay, MessageToast } from "./Toasts";
import { LayersPanel } from "./LayersPanel";
import { MenuRow } from "./MenuRow";
import { PrintArea } from "./PrintArea";
import { Ribbon } from "./ribbon/Ribbon";
import { TextBar } from "./ribbon/TextBar";
import { StatusBar } from "./StatusBar";

export function App() {
  const app = usePaint();
  const statusBar = useEditor((s) => s.view.statusBar);
  const textActive = useEditor((s) => s.tool === "text");
  const layersPanel = useEditor((s) => s.layersPanel);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Fields in dialogs and the ribbon keep their own keys.
      const t = e.target as HTMLElement | null;
      const inField = t?.matches("input, select, [contenteditable=true]") || (t?.tagName === "TEXTAREA" && !t.classList.contains("text-box-input"));
      if (inField || app.editor.state.dialog) return;
      if (handleShortcut(app, e)) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [app]);

  useEffect(() => {
    const stop = (e: DragEvent) => e.preventDefault();
    const drop = (e: DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer?.files?.[0];
      if (f) void app.files.openDropped(f);
    };
    window.addEventListener("dragover", stop);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", stop);
      window.removeEventListener("drop", drop);
    };
  }, [app]);

  return (
    <div className="app" onContextMenu={(e) => e.preventDefault()}>
      <MenuRow />
      <Ribbon />
      {textActive && <TextBar />}
      <div className="workspace">
        <CanvasView />
        {layersPanel && <LayersPanel />}
      </div>
      {statusBar && <StatusBar />}
      <Dialogs />
      <MessageToast />
      <BusyOverlay />
      <PrintArea />
    </div>
  );
}
