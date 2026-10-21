import { HANDLES, handlePoint } from "../../core/geometry";
import { useEditor } from "../app-context";

/** Dashed selection/shape box with its 8 handles, or the free-form outline, drawn above the picture. */
export function Overlay() {
  const overlay = useEditor((s) => s.overlay);
  const zoom = useEditor((s) => s.zoom);
  if (!overlay || overlay.kind === "canvasSize") return null;

  if (overlay.kind === "lasso") {
    const pts = overlay.points.map((p) => `${p.x * zoom},${p.y * zoom}`).join(" ");
    return (
      <svg className="overlay">
        <polyline points={pts} className="ants-under" />
        <polyline points={pts} className="ants" />
      </svg>
    );
  }

  const r = { x: overlay.rect.x * zoom, y: overlay.rect.y * zoom, w: overlay.rect.w * zoom, h: overlay.rect.h * zoom };
  return (
    <svg className="overlay">
      <rect x={r.x + 0.5} y={r.y + 0.5} width={Math.max(0, r.w - 1)} height={Math.max(0, r.h - 1)} className="ants-under" />
      <rect x={r.x + 0.5} y={r.y + 0.5} width={Math.max(0, r.w - 1)} height={Math.max(0, r.h - 1)} className="ants" />
      {overlay.outlines?.map((line, i) => {
        const pts = line.map((p) => `${p.x * zoom},${p.y * zoom}`).join(" ");
        return (
          <g key={i}>
            <polygon points={pts} className="ants-under" />
            <polygon points={pts} className="ants" />
          </g>
        );
      })}
      {overlay.handles &&
        HANDLES.map((h) => {
          const p = handlePoint(r, h);
          return <rect key={h} x={p.x - 3.5} y={p.y - 3.5} width={7} height={7} className="handle" />;
        })}
    </svg>
  );
}
