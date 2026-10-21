import { useEffect, useRef } from "react";

import { toCss } from "../../core/color";
import { LINE_HEIGHT, ptToPx } from "../../core/text";
import { useEditor, usePaint } from "../app-context";

/**
 * The typing area of a text box. Its own text is invisible: the picture
 * shows the text as the editor will draw it, so only the caret and the
 * selection highlight come from here.
 */
export function TextBoxInput() {
  const { text } = usePaint();
  const box = useEditor((s) => s.textBox);
  const zoom = useEditor((s) => s.zoom);
  const style = useEditor((s) => s.text);
  const caret = useEditor((s) => s.primary);
  const ref = useRef<HTMLTextAreaElement>(null);
  const open = box !== null;

  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);

  if (!box) return null;
  const px = ptToPx(style.size) * zoom;
  return (
    <textarea
      ref={ref}
      className="text-box-input"
      spellCheck={false}
      value={box.value}
      onChange={(e) => text.setValue(e.target.value)}
      style={{
        left: box.rect.x * zoom,
        top: box.rect.y * zoom,
        width: box.rect.w * zoom,
        height: box.rect.h * zoom,
        fontFamily: `"${style.font}"`,
        fontSize: px,
        lineHeight: `${px * LINE_HEIGHT}px`,
        fontWeight: style.bold ? 700 : 400,
        fontStyle: style.italic ? "italic" : "normal",
        caretColor: toCss(caret),
      }}
    />
  );
}
