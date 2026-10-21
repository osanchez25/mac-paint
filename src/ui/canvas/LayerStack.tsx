import { Fragment, useLayoutEffect, useRef } from "react";

import { useEditor, usePaint } from "../app-context";

/**
 * The layer canvases stacked in order, bottom first, with the preview layer
 * (strokes and shapes in progress) right above the active layer, so what you
 * draw shows at the right depth.
 */
export function LayerStack() {
  const { editor } = usePaint();
  const layers = useEditor((s) => s.layers);
  const active = useEditor((s) => s.activeLayer);
  return (
    <div className="canvas-host">
      {layers.map((info) => {
        const layer = editor.doc.layers.find((l) => l.id === info.id);
        if (!layer) return null;
        return (
          <Fragment key={info.id}>
            <Mount el={layer.canvas} hidden={!info.visible} />
            {info.id === active && <Mount key={`preview-${active}`} el={editor.preview} hidden={false} />}
          </Fragment>
        );
      })}
    </div>
  );
}

/** Puts a canvas the editor owns into the page. */
function Mount({ el, hidden }: { el: HTMLCanvasElement; hidden: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    ref.current?.append(el);
    return () => el.remove();
  }, [el]);
  return <div ref={ref} className="layer-slot" style={hidden ? { display: "none" } : undefined} />;
}
