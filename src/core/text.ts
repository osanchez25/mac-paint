/**
 * Breaks text into lines that fit `maxWidth`, the way a text box wraps:
 * at spaces when possible, inside a word only when the word alone is too wide.
 * Explicit line breaks are kept.
 */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    if (para === "") {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of para.split(/(?<= )/)) {
      const candidate = line + word;
      if (measure(candidate.trimEnd()) <= maxWidth || line === "") {
        if (line === "" && measure(word.trimEnd()) > maxWidth) {
          // A single word wider than the box: break it by characters.
          let piece = "";
          for (const ch of word) {
            if (piece && measure(piece + ch) > maxWidth) {
              out.push(piece);
              piece = "";
            }
            piece += ch;
          }
          line = piece;
        } else {
          line = candidate;
        }
      } else {
        out.push(line.trimEnd());
        line = word;
      }
    }
    out.push(line.trimEnd());
  }
  return out;
}

/** Points to pixels at Paint's 96 DPI. */
export function ptToPx(pt: number): number {
  return (pt * 96) / 72;
}

export function cssFont(font: string, sizePt: number, bold: boolean, italic: boolean): string {
  return `${italic ? "italic " : ""}${bold ? "bold " : ""}${ptToPx(sizePt).toFixed(2)}px "${font}"`;
}

export const LINE_HEIGHT = 1.25;
