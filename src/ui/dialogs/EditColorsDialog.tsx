import {
  Button,
  ColorArea,
  ColorPicker,
  ColorSlider,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
} from "@fluentui/react-components";
import { useState } from "react";

import { clampByte, hsvToRgb, parseHex, rgbToHsv, toHex, type HSV, type RGBA } from "../../core/color";
import { useEditor, usePaint } from "../app-context";

/** Edit colors: pick any color for the selected slot; it is also added to the custom colors row. */
export function EditColorsDialog() {
  const { editor } = usePaint();
  const slot = useEditor((s) => s.activeSlot);
  const start = useEditor((s) => (s.activeSlot === 1 ? s.primary : s.secondary));
  const [hsv, setHsv] = useState<HSV>(rgbToHsv(start));
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const rgb = hsvToRgb(hsv);
  const close = () => editor.set({ dialog: null });

  const setRgb = (c: RGBA) => {
    setHsv(rgbToHsv(c));
    setHexDraft(null);
  };
  const channel = (key: "r" | "g" | "b", label: string) => (
    <Field label={label}>
      <Input type="number" min={0} max={255} value={String(rgb[key])} onChange={(_, d) => setRgb({ ...rgb, [key]: clampByte(Number(d.value) || 0) })} />
    </Field>
  );

  const ok = () => {
    editor.setColor(slot, rgb);
    editor.addCustomColor(rgb);
    close();
  };

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && close()}>
      <DialogSurface className="paint-dialog">
        <DialogBody>
          <DialogTitle>Edit colors</DialogTitle>
          <DialogContent className="dialog-form">
            <ColorPicker color={hsv} onColorChange={(_, d) => { setHsv({ h: d.color.h, s: d.color.s, v: d.color.v }); setHexDraft(null); }}>
              <ColorArea />
              <ColorSlider />
            </ColorPicker>
            <div className="color-compare">
              <span style={{ background: toHex(start) }} title="Current" />
              <span style={{ background: toHex(rgb) }} title="New" />
            </div>
            <div className="field-row">
              <Field label="Hex">
                <Input
                  value={hexDraft ?? toHex(rgb).toUpperCase()}
                  onChange={(_, d) => {
                    setHexDraft(d.value);
                    const c = parseHex(d.value);
                    if (c) setHsv(rgbToHsv(c));
                  }}
                />
              </Field>
              {channel("r", "Red")}
              {channel("g", "Green")}
              {channel("b", "Blue")}
            </div>
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" onClick={ok}>OK</Button>
            <Button onClick={close}>Cancel</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
