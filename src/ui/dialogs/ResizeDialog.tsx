import { Button, Checkbox, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Field, Input } from "@fluentui/react-components";
import { useState } from "react";

import { keepRatio, type ResizeBy } from "../../core/image-math";
import { messageOf } from "../../editor/actions/file-actions";
import { usePaint } from "../app-context";

/** "Resize and skew" (⌃W): resize by percentage or pixels, keep aspect ratio, skew in degrees. */
export function ResizeDialog() {
  const { editor, image, selection } = usePaint();
  const base = selection.bounds ?? editor.doc.bounds;
  const [by, setBy] = useState<ResizeBy>("percent");
  const [h, setH] = useState("100");
  const [v, setV] = useState("100");
  const [ratio, setRatio] = useState(true);
  const [skewH, setSkewH] = useState("0");
  const [skewV, setSkewV] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const close = () => editor.set({ dialog: null });

  const switchBy = (next: ResizeBy) => {
    setBy(next);
    setH(next === "percent" ? "100" : String(base.w));
    setV(next === "percent" ? "100" : String(base.h));
  };
  const changeH = (value: string) => {
    setH(value);
    const n = Number(value);
    if (ratio && Number.isFinite(n) && n > 0) setV(String(keepRatio(base.w, base.h, by, "h", n)));
  };
  const changeV = (value: string) => {
    setV(value);
    const n = Number(value);
    if (ratio && Number.isFinite(n) && n > 0) setH(String(keepRatio(base.w, base.h, by, "v", n)));
  };

  const apply = () => {
    const sh = Number(skewH);
    const sv = Number(skewV);
    if (!(Math.abs(sh) <= 89 && Math.abs(sv) <= 89)) {
      setError("Skew must be a number of degrees between -89 and 89.");
      return;
    }
    try {
      image.resizeAndSkew({ by, horizontal: Number(h), vertical: Number(v) }, sh, sv);
      close();
    } catch (e) {
      setError(messageOf(e));
    }
  };

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && close()}>
      <DialogSurface className="paint-dialog">
        <DialogBody>
          <DialogTitle>Resize and skew</DialogTitle>
          <DialogContent className="dialog-form">
            <h3>Resize</h3>
            <div className="segmented" role="radiogroup" aria-label="Resize by">
              <button className={by === "percent" ? "active" : ""} onClick={() => switchBy("percent")} role="radio" aria-checked={by === "percent"}>
                Percentage
              </button>
              <button className={by === "pixels" ? "active" : ""} onClick={() => switchBy("pixels")} role="radio" aria-checked={by === "pixels"}>
                Pixels
              </button>
            </div>
            <div className="field-row">
              <Field label="Horizontal">
                <Input type="number" value={h} onChange={(_, d) => changeH(d.value)} contentAfter={by === "percent" ? "%" : "px"} />
              </Field>
              <Field label="Vertical">
                <Input type="number" value={v} onChange={(_, d) => changeV(d.value)} contentAfter={by === "percent" ? "%" : "px"} />
              </Field>
            </div>
            <Checkbox label="Maintain aspect ratio" checked={ratio} onChange={(_, d) => setRatio(Boolean(d.checked))} />
            <h3>Skew (degrees)</h3>
            <div className="field-row">
              <Field label="Horizontal">
                <Input type="number" value={skewH} onChange={(_, d) => setSkewH(d.value)} contentAfter="°" />
              </Field>
              <Field label="Vertical">
                <Input type="number" value={skewV} onChange={(_, d) => setSkewV(d.value)} contentAfter="°" />
              </Field>
            </div>
            {error && <p className="dialog-error">{error}</p>}
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" onClick={apply}>OK</Button>
            <Button onClick={close}>Cancel</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
