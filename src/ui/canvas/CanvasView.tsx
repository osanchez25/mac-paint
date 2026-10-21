import { useEffect, useLayoutEffect, useRef } from "react";

import type { Point } from "../../core/geometry";
import type { ToolPointer } from "../../editor/tools/tool";
import { useEditor, usePaint } from "../app-context";
import { sizeGroupOf } from "../../editor/state";
import { CanvasHandles } from "./CanvasHandles";
import { LayerStack } from "./LayerStack";
import { cssCursor } from "./cursors";
import { Overlay } from "./Overlay";
import { TextBoxInput } from "./TextBoxInput";

/** Space around the picture inside the gray area, like Paint. */
const PAD = 24;
/** How close (screen px) counts as grabbing a handle. */
const GRAB = 6;

export function CanvasView() {
  const app = usePaint();
  const { editor } = app;
  const zoom = useEditor((s) => s.zoom);
  const width = useEditor((s) => s.width);
  const height = useEditor((s) => s.height);
  const cursor = useEditor((s) => cssCursor(s.cursor, s.tool, s.brush, s.sizes[sizeGroupOf(s)], s.zoom));
  const gridlines = useEditor((s) => s.view.gridlines);

  const scrollRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const pressed = useRef(false);
  const anchor = useRef<{ p: Point; screen: Point } | null>(null);

  const w = width * zoom;
  const h = height * zoom;

  useEffect(() => {
    editor.attachViewport({
      origin: () => {
        const el = scrollRef.current;
        const fr = frameRef.current;
        if (!el || !fr) return { x: 0, y: 0 };
        const z = editor.state.zoom;
        return { x: Math.max(0, (el.scrollLeft - fr.offsetLeft) / z), y: Math.max(0, (el.scrollTop - fr.offsetTop) / z) };
      },
      size: () => ({ w: scrollRef.current?.clientWidth ?? 800, h: scrollRef.current?.clientHeight ?? 600 }),
      keepPoint: (p) => {
        const el = scrollRef.current;
        const fr = frameRef.current;
        if (!el || !fr) return;
        const z = editor.state.zoom;
        anchor.current = { p, screen: { x: fr.offsetLeft + p.x * z - el.scrollLeft, y: fr.offsetTop + p.y * z - el.scrollTop } };
      },
    });
    return () => editor.attachViewport(null);
  }, [editor]);

  // After a zoom, scroll so the anchored point stays under the mouse.
  useLayoutEffect(() => {
    const a = anchor.current;
    const el = scrollRef.current;
    const fr = frameRef.current;
    anchor.current = null;
    if (!a || !el || !fr) return;
    el.scrollLeft = fr.offsetLeft + a.p.x * zoom - a.screen.x;
    el.scrollTop = fr.offsetTop + a.p.y * zoom - a.screen.y;
  }, [zoom]);

  // Pinch or Cmd+scroll zooms around the pointer.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const z = editor.state.zoom;
      editor.setZoom(z * Math.exp(-e.deltaY * 0.01), toPicture(e));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  function toPicture(e: { clientX: number; clientY: number }): Point {
    const r = frameRef.current!.getBoundingClientRect();
    const z = editor.state.zoom;
    return { x: (e.clientX - r.left) / z, y: (e.clientY - r.top) / z };
  }

  function info(e: React.PointerEvent): ToolPointer {
    const right = e.button === 2 || (e.buttons & 2) === 2 || (e.button === 0 && e.ctrlKey);
    return {
      p: toPicture(e),
      button: right ? 2 : 1,
      shift: e.shiftKey,
      alt: e.altKey,
      mod: e.metaKey,
      tolerance: GRAB / editor.state.zoom,
      double: e.detail === 2,
    };
  }

  const onDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest(".text-box-input, .canvas-handle")) return;
    if (e.button !== 0 && e.button !== 2) return;
    e.preventDefault();
    (document.activeElement as HTMLElement | null)?.blur?.();
    scrollRef.current?.setPointerCapture(e.pointerId);
    pressed.current = true;
    editor.pointerDown(info(e));
  };

  const onMove = (e: React.PointerEvent) => {
    editor.pointerMove(info(e), pressed.current);
  };

  const onUp = (e: React.PointerEvent) => {
    if (!pressed.current) return;
    pressed.current = false;
    scrollRef.current?.releasePointerCapture(e.pointerId);
    editor.pointerUp(info(e));
  };

  const stageW = w + PAD * 2;
  const stageH = h + PAD * 2;

  return (
    <div
      className="canvas-area"
      ref={scrollRef}
      style={{ cursor }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={() => editor.pointerLeave()}
    >
      <div className="canvas-stage" style={{ minWidth: `max(100%, ${stageW}px)`, minHeight: `max(100%, ${stageH}px)` }}>
        <div
          className={`canvas-frame${zoom > 1 ? " pixelated" : ""}`}
          ref={frameRef}
          style={{ width: w, height: h }}
        >
          <LayerStack />
          {gridlines && zoom >= 2 && <div className="gridlines" style={{ backgroundSize: `${zoom}px ${zoom}px` }} />}
          <Overlay />
          <TextBoxInput />
          <CanvasHandles frameRef={frameRef} />
        </div>
      </div>
    </div>
  );
}
