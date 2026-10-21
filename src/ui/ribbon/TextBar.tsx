import { Tooltip } from "@fluentui/react-components";
import {
  TextBoldRegular,
  TextItalicRegular,
  TextStrikethroughRegular,
  TextUnderlineRegular,
} from "@fluentui/react-icons";

import type { TextStyle } from "../../editor/state";
import { useEditor, usePaint } from "../app-context";

/** Fonts every Mac has. */
const FONTS = [
  "Arial",
  "Arial Black",
  "Avenir Next",
  "Comic Sans MS",
  "Courier New",
  "Futura",
  "Georgia",
  "Gill Sans",
  "Helvetica",
  "Helvetica Neue",
  "Impact",
  "Menlo",
  "Palatino",
  "Times New Roman",
  "Trebuchet MS",
  "Verdana",
];

const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];

/** Paint's text toolbar: shows while the Text tool is picked. */
export function TextBar() {
  const { editor } = usePaint();
  const t = useEditor((s) => s.text);
  const set = (patch: Partial<TextStyle>) => {
    editor.set({ text: { ...t, ...patch } });
    editor.refreshTool();
  };
  const toggle = (key: "bold" | "italic" | "underline" | "strike", tip: string, icon: React.ReactNode) => (
    <Tooltip content={tip} relationship="label" positioning="below">
      <button
        className={`tool-btn${t[key] ? " active" : ""}`}
        aria-pressed={t[key]}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => set({ [key]: !t[key] })}
      >
        {icon}
      </button>
    </Tooltip>
  );

  return (
    <div className="text-bar">
      <select className="font-select" value={t.font} onChange={(e) => set({ font: e.target.value })} aria-label="Font family">
        {FONTS.map((f) => (
          <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
        ))}
      </select>
      <select className="size-select" value={t.size} onChange={(e) => set({ size: Number(e.target.value) })} aria-label="Font size">
        {SIZES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <span className="menu-sep" />
      {toggle("bold", "Bold (⌘B)", <TextBoldRegular />)}
      {toggle("italic", "Italic (⌘I)", <TextItalicRegular />)}
      {toggle("underline", "Underline (⌘U)", <TextUnderlineRegular />)}
      {toggle("strike", "Strikethrough", <TextStrikethroughRegular />)}
      <span className="menu-sep" />
      <div className="segmented" role="radiogroup" aria-label="Background">
        <button className={!t.opaque ? "active" : ""} onClick={() => set({ opaque: false })} role="radio" aria-checked={!t.opaque}>
          Transparent
        </button>
        <button className={t.opaque ? "active" : ""} onClick={() => set({ opaque: true })} role="radio" aria-checked={t.opaque}>
          Fill background
        </button>
      </div>
    </div>
  );
}
