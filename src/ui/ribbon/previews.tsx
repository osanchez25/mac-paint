import { useEffect, useRef, useState } from "react";

import { BLACK } from "../../core/color";
import { boxShapePath, type PathCmd, type ShapeKind } from "../../core/shapes";
import { createEngine } from "../../editor/brushes/engines";
import type { BrushKind } from "../../editor/state";

/** SVG path data for our shape outlines, so gallery icons are the real shapes. */
export function svgPath(cmds: readonly PathCmd[]): string {
  return cmds
    .map((c) => {
      switch (c.op) {
        case "M": return `M${c.x} ${c.y}`;
        case "L": return `L${c.x} ${c.y}`;
        case "C": return `C${c.x1} ${c.y1} ${c.x2} ${c.y2} ${c.x} ${c.y}`;
        case "E": return `M${c.cx + c.rx} ${c.cy}A${c.rx} ${c.ry} 0 1 0 ${c.cx - c.rx} ${c.cy}A${c.rx} ${c.ry} 0 1 0 ${c.cx + c.rx} ${c.cy}`;
        case "Z": return "Z";
      }
    })
    .join("");
}

export function ShapeIcon({ kind, size = 20 }: { kind: ShapeKind; size?: number }) {
  let d: string;
  if (kind === "line") d = "M3 17L17 3";
  else if (kind === "curve") d = "M3 16C6 2 12 18 17 4";
  else if (kind === "polygon") d = "M4 16L3 7L9 3L17 6L14 16Z";
  else d = svgPath(boxShapePath(kind, { x: 2.5, y: 3, w: 15, h: 14 }));
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** A real sample stroke drawn with the brush engine, like Paint's brush menu. */
export function BrushSample({ kind, width = 56, height = 28 }: { kind: BrushKind; width?: number; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [theme, setTheme] = useState(0);
  // The sample is drawn in the text color, so redraw when light/dark changes.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setTheme((t) => t + 1);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const scale = window.devicePixelRatio || 1;
    c.width = width * scale;
    c.height = height * scale;
    const ctx = c.getContext("2d")!;
    const color = getComputedStyle(c).color;
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color);
    const rgba = m ? { r: +m[1], g: +m[2], b: +m[3], a: 255 } : BLACK;
    // Drawn in device pixels (no ctx.scale) so mask-based brushes line up.
    const engine = createEngine(kind, c.width, c.height, 3);
    const style = { color: rgba, size: (kind === "airbrush" ? 3 : 6) * scale };
    const layer = document.createElement("canvas");
    layer.width = c.width;
    layer.height = c.height;
    const lctx = layer.getContext("2d")!;
    const at = (t: number) => ({
      x: (6 + t * (width - 12)) * scale,
      y: (height / 2 + Math.sin(t * Math.PI * 2) * height * 0.22) * scale,
    });
    let prev = at(0);
    engine.begin(lctx, prev, style);
    for (let i = 1; i <= 24; i++) {
      const p = at(i / 24);
      engine.to(lctx, prev, p, style);
      prev = p;
    }
    ctx.globalAlpha = engine.opacity;
    ctx.drawImage(layer, 0, 0);
  }, [kind, width, height, theme]);
  return <canvas ref={ref} className="brush-sample" style={{ width, height }} aria-hidden />;
}

/** A horizontal bar of the given thickness, for the Size menu. */
export function SizeLine({ px }: { px: number }) {
  return <span className="size-line" style={{ height: Math.min(px, 16) }} />;
}
