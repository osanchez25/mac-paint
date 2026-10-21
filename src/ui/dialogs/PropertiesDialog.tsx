import { Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Field, Input } from "@fluentui/react-components";
import { useState } from "react";

import { DPI, formatBytes, fromPixels, toPixels, type Unit } from "../../core/image-math";
import { DEFAULT_HEIGHT, DEFAULT_WIDTH } from "../../editor/state";
import { useEditor, usePaint } from "../app-context";

const UNITS: { id: Unit; label: string }[] = [
  { id: "in", label: "Inches" },
  { id: "cm", label: "Centimeters" },
  { id: "px", label: "Pixels" },
];

/** Image properties (⌘E): file facts and the canvas size in inches, centimeters or pixels. */
export function PropertiesDialog() {
  const { editor, image } = usePaint();
  const file = useEditor((s) => s.file);
  const [unit, setUnit] = useState<Unit>("px");
  const [w, setW] = useState(String(editor.doc.width));
  const [h, setH] = useState(String(editor.doc.height));
  const close = () => editor.set({ dialog: null });

  const switchUnit = (next: Unit) => {
    const pw = toPixels(Number(w), unit);
    const ph = toPixels(Number(h), unit);
    setUnit(next);
    setW(String(fromPixels(pw, next)));
    setH(String(fromPixels(ph, next)));
  };

  const apply = () => {
    const pw = toPixels(Number(w), unit);
    const ph = toPixels(Number(h), unit);
    if (!(pw >= 1 && ph >= 1)) {
      editor.showError("Width and height must be at least 1 pixel.");
      return;
    }
    image.setCanvasSize(pw, ph);
    close();
  };

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && close()}>
      <DialogSurface className="paint-dialog">
        <DialogBody>
          <DialogTitle>Image properties</DialogTitle>
          <DialogContent className="dialog-form">
            <dl className="facts">
              <dt>File</dt>
              <dd>{file.path ?? "Not saved yet"}</dd>
              <dt>Size on disk</dt>
              <dd>{file.bytes !== null ? formatBytes(file.bytes) : "Not available"}</dd>
              <dt>Resolution</dt>
              <dd>{DPI} DPI</dd>
            </dl>
            <h3>Units</h3>
            <div className="segmented" role="radiogroup" aria-label="Units">
              {UNITS.map((u) => (
                <button key={u.id} className={unit === u.id ? "active" : ""} onClick={() => switchUnit(u.id)} role="radio" aria-checked={unit === u.id}>
                  {u.label}
                </button>
              ))}
            </div>
            <div className="field-row">
              <Field label="Width">
                <Input type="number" value={w} onChange={(_, d) => setW(d.value)} />
              </Field>
              <Field label="Height">
                <Input type="number" value={h} onChange={(_, d) => setH(d.value)} />
              </Field>
            </div>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setW(String(fromPixels(DEFAULT_WIDTH, unit)));
                setH(String(fromPixels(DEFAULT_HEIGHT, unit)));
              }}
            >
              Default
            </Button>
            <Button appearance="primary" onClick={apply}>OK</Button>
            <Button onClick={close}>Cancel</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
