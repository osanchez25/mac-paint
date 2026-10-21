import { Tooltip } from "@fluentui/react-components";

import { parseHex, PALETTE, toHex, type RGBA } from "../../core/color";
import { useEditor, usePaint } from "../app-context";
import { RibbonGroup } from "./parts";

/**
 * Color 1 / color 2 (the selected one has a ring), the 20-color palette,
 * a row of custom colors, and Edit colors.
 */
export function ColorsGroup() {
  const { editor } = usePaint();
  const primary = useEditor((s) => s.primary);
  const secondary = useEditor((s) => s.secondary);
  const slot = useEditor((s) => s.activeSlot);
  const custom = useEditor((s) => s.customColors);

  const swatch = (hex: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    const c = parseHex(hex);
    if (c) editor.pickSwatch(c, e.button === 2 ? 2 : 1);
  };

  return (
    <RibbonGroup label="Colors">
      <div className="colors">
        <div className="current-colors">
          <CurrentColor color={primary} label="Color 1" selected={slot === 1} onClick={() => editor.set({ activeSlot: 1 })} />
          <CurrentColor color={secondary} label="Color 2" selected={slot === 2} onClick={() => editor.set({ activeSlot: 2 })} />
        </div>
        <div className="palette">
          {PALETTE.map((hex) => (
            <Tooltip key={hex} content={hex.toUpperCase()} relationship="label" positioning="below">
              <button className="swatch" style={{ background: hex }} onMouseDown={swatch(hex)} aria-label={hex} />
            </Tooltip>
          ))}
          {custom.map((hex, i) =>
            hex ? (
              <button key={`c${i}`} className="swatch" style={{ background: hex }} onMouseDown={swatch(hex)} aria-label={hex} title={hex.toUpperCase()} />
            ) : (
              <span key={`c${i}`} className="swatch empty" aria-hidden />
            ),
          )}
        </div>
        <Tooltip content="Edit colors" relationship="label" positioning="below" withArrow>
          <button className="edit-colors" onClick={() => editor.set({ dialog: "editColors" })} aria-label="Edit colors">
            <span className="rainbow" />
          </button>
        </Tooltip>
      </div>
    </RibbonGroup>
  );
}

function CurrentColor({ color, label, selected, onClick }: { color: RGBA; label: string; selected: boolean; onClick: () => void }) {
  return (
    <Tooltip content={`${label} (${toHex(color).toUpperCase()})`} relationship="label" positioning="below">
      <button className={`current-color${selected ? " selected" : ""}`} onClick={onClick} aria-pressed={selected} aria-label={label}>
        <span style={{ background: toHex(color) }} />
      </button>
    </Tooltip>
  );
}
