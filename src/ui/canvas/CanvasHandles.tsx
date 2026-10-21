import { useRef, useState, type RefObject } from "react";

import { useEditor, usePaint } from "../app-context";

type Edge = "e" | "s" | "se";

/**
 * The three small squares on the right, bottom and corner of the picture:
 * drag them to change the canvas size (the picture is not stretched).
 */
export function CanvasHandles({ frameRef }: { frameRef: RefObject<HTMLDivElement | null> }) {
  const { editor, image } = usePaint();
  const zoom = useEditor((s) => s.zoom);
  const width = useEditor((s) => s.width);
  const height = useEditor((s) => s.height);
  const [draft, setDraft] = useState<{ w: number; h: number } | null>(null);
  const drag = useRef<{ edge: Edge; x: number; y: number } | null>(null);

  const size = (e: React.PointerEvent, edge: Edge) => {
    const r = frameRef.current!.getBoundingClientRect();
    const nw = edge === "s" ? width : Math.max(1, Math.round((e.clientX - r.left) / zoom));
    const nh = edge === "e" ? height : Math.max(1, Math.round((e.clientY - r.top) / zoom));
    return { w: nw, h: nh };
  };

  const handle = (edge: Edge, style: React.CSSProperties, cursor: string) => (
    <div
      className="canvas-handle"
      style={{ ...style, cursor }}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        editor.tool().commit();
        drag.current = { edge, x: e.clientX, y: e.clientY };
        setDraft({ w: width, h: height });
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const d = size(e, drag.current.edge);
        setDraft(d);
        editor.set({ selectionSize: d });
      }}
      onPointerUp={(e) => {
        if (!drag.current) return;
        const d = size(e, drag.current.edge);
        drag.current = null;
        setDraft(null);
        editor.set({ selectionSize: null });
        image.setCanvasSize(d.w, d.h);
      }}
    />
  );

  const w = width * zoom;
  const h = height * zoom;
  return (
    <>
      {handle("e", { left: w + 2, top: h / 2 - 3 }, "ew-resize")}
      {handle("s", { left: w / 2 - 3, top: h + 2 }, "ns-resize")}
      {handle("se", { left: w + 2, top: h + 2 }, "nwse-resize")}
      {draft && <div className="canvas-size-draft" style={{ width: draft.w * zoom, height: draft.h * zoom }} />}
    </>
  );
}
