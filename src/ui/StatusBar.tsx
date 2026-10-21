import { Slider, Tooltip } from "@fluentui/react-components";
import {
  AddRegular,
  CursorRegular,
  DocumentRegular,
  ImageRegular,
  SelectObjectRegular,
  SubtractRegular,
  ZoomFitRegular,
} from "@fluentui/react-icons";

import { formatBytes, ZOOM_STEPS } from "../core/image-math";
import { useEditor, usePaint } from "./app-context";

/** Zoom slider position ↔ zoom, logarithmic like Paint's (12.5%…800%). */
const MIN = Math.log(ZOOM_STEPS[0]);
const MAX = Math.log(ZOOM_STEPS[ZOOM_STEPS.length - 1]);
const toSlider = (z: number) => Math.round(((Math.log(z) - MIN) / (MAX - MIN)) * 1000);
const fromSlider = (v: number) => Math.exp(MIN + (v / 1000) * (MAX - MIN));

const PRESETS = [8, 7, 6, 5, 4, 3, 2, 1, 0.5, 0.25, 0.125];

/** Cursor position, selection size, picture size, file size, and zoom, like Paint's bottom bar. */
export function StatusBar() {
  const { editor } = usePaint();
  const pos = useEditor((s) => s.cursorPos);
  const sel = useEditor((s) => s.selectionSize);
  const width = useEditor((s) => s.width);
  const height = useEditor((s) => s.height);
  const bytes = useEditor((s) => s.file.bytes);
  const zoom = useEditor((s) => s.zoom);
  const pct = Math.round(zoom * 100);

  return (
    <footer className="status-bar">
      <span className="status-item" title="Cursor position">
        <CursorRegular />
        {pos ? `${pos.x}, ${pos.y}px` : ""}
      </span>
      <span className="status-item" title="Selection size">
        <SelectObjectRegular />
        {sel ? `${sel.w} × ${sel.h}px` : ""}
      </span>
      <span className="status-item" title="Canvas size">
        <ImageRegular />
        {`${width} × ${height}px`}
      </span>
      <span className="status-item" title="File size">
        <DocumentRegular />
        {bytes !== null ? `Size: ${formatBytes(bytes)}` : ""}
      </span>
      <span className="status-spacer" />
      <Tooltip content="Fit to window (⌘9)" relationship="label" positioning="above">
        <button className="icon-btn small" onClick={() => editor.zoomToFit()}>
          <ZoomFitRegular />
        </button>
      </Tooltip>
      <select className="zoom-select" value={PRESETS.includes(zoom) ? zoom : ""} onChange={(e) => editor.setZoom(Number(e.target.value))} aria-label="Zoom">
        {!PRESETS.includes(zoom) && <option value="">{pct}%</option>}
        {PRESETS.map((z) => (
          <option key={z} value={z}>{Math.round(z * 100)}%</option>
        ))}
      </select>
      <button className="icon-btn small" onClick={() => editor.zoomStep(-1)} aria-label="Zoom out">
        <SubtractRegular />
      </button>
      <Slider className="zoom-slider" min={0} max={1000} value={toSlider(zoom)} onChange={(_, d) => editor.setZoom(fromSlider(d.value))} aria-label="Zoom" />
      <button className="icon-btn small" onClick={() => editor.zoomStep(1)} aria-label="Zoom in">
        <AddRegular />
      </button>
    </footer>
  );
}
