import { Popover, PopoverSurface, PopoverTrigger, Slider } from "@fluentui/react-components";
import { LineHorizontal3Regular, ShapesRegular } from "@fluentui/react-icons";
import { useState } from "react";

import { SHAPE_KINDS, SHAPE_LABELS } from "../../core/shapes";
import { BRUSH_KINDS, BRUSH_LABELS, SIZE_PRESETS, sizeGroupOf, type FillStyle, type OutlineStyle } from "../../editor/state";
import { useEditor, usePaint } from "../app-context";
import { BigButton, BigSplit, ChevronButton, RibbonGroup } from "./parts";
import { BrushSample, ShapeIcon, SizeLine } from "./previews";

export function BrushesGroup() {
  const { editor } = usePaint();
  const tool = useEditor((s) => s.tool);
  const brush = useEditor((s) => s.brush);
  const [open, setOpen] = useState(false);
  return (
    <RibbonGroup label="Brushes">
      <BigSplit icon={<BrushSample kind={brush} width={30} height={26} />} tip={BRUSH_LABELS[brush]} active={tool === "brush"} onClick={() => editor.setTool("brush")}>
      <Popover open={open} onOpenChange={(_, d) => setOpen(d.open)} positioning="below-start">
        <PopoverTrigger disableButtonEnhancement>
          <ChevronButton label="Brushes" />
        </PopoverTrigger>
        <PopoverSurface className="gallery brushes">
          {BRUSH_KINDS.map((k) => (
            <button
              key={k}
              className={`gallery-item${k === brush ? " active" : ""}`}
              title={BRUSH_LABELS[k]}
              aria-label={BRUSH_LABELS[k]}
              onClick={() => {
                editor.set({ brush: k });
                editor.setTool("brush");
                setOpen(false);
              }}
            >
              <BrushSample kind={k} />
            </button>
          ))}
        </PopoverSurface>
      </Popover>
      </BigSplit>
    </RibbonGroup>
  );
}

const OUTLINES: { id: OutlineStyle; label: string }[] = [
  { id: "none", label: "No outline" },
  { id: "solid", label: "Solid color" },
  { id: "crayon", label: "Crayon" },
  { id: "marker", label: "Marker" },
  { id: "oil", label: "Oil" },
  { id: "naturalPencil", label: "Natural pencil" },
  { id: "watercolor", label: "Watercolor" },
];

const FILLS: { id: FillStyle; label: string }[] = [
  { id: "none", label: "No fill" },
  { id: "solid", label: "Solid color" },
];

export function ShapesGroup() {
  const { editor } = usePaint();
  const tool = useEditor((s) => s.tool);
  const shape = useEditor((s) => s.shape);
  const outline = useEditor((s) => s.outline);
  const fill = useEditor((s) => s.fill);
  const [open, setOpen] = useState(false);
  const setStyle = (patch: { outline?: OutlineStyle; fill?: FillStyle }) => {
    editor.set(patch);
    editor.refreshTool();
  };
  return (
    <RibbonGroup label="Shapes">
      <BigSplit icon={tool === "shape" ? <ShapeIcon kind={shape} size={24} /> : <ShapesRegular />} tip={SHAPE_LABELS[shape]} active={tool === "shape"} onClick={() => editor.setTool("shape")}>
      <Popover open={open} onOpenChange={(_, d) => setOpen(d.open)} positioning="below-start">
        <PopoverTrigger disableButtonEnhancement>
          <ChevronButton label="Shapes" />
        </PopoverTrigger>
        <PopoverSurface className="shapes-surface">
          <div className="gallery shapes">
            {SHAPE_KINDS.map((k) => (
              <button
                key={k}
                className={`gallery-item small${k === shape && tool === "shape" ? " active" : ""}`}
                title={SHAPE_LABELS[k]}
                aria-label={SHAPE_LABELS[k]}
                onClick={() => {
                  editor.setTool("shape");
                  editor.set({ shape: k });
                  setOpen(false);
                }}
              >
                <ShapeIcon kind={k} />
              </button>
            ))}
          </div>
          <div className="shape-options">
            <label>
              Outline
              <select value={outline} onChange={(e) => setStyle({ outline: e.target.value as OutlineStyle })}>
                {OUTLINES.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </label>
            <label>
              Fill
              <select value={fill} onChange={(e) => setStyle({ fill: e.target.value as FillStyle })}>
                {FILLS.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>
        </PopoverSurface>
      </Popover>
      </BigSplit>
    </RibbonGroup>
  );
}

export function SizeGroup() {
  const { editor } = usePaint();
  const group = useEditor((s) => sizeGroupOf(s));
  const size = useEditor((s) => s.sizes[sizeGroupOf(s)]);
  const disabled = group === "select";
  return (
    <RibbonGroup label="Size">
      <Popover positioning="below-start">
        <PopoverTrigger disableButtonEnhancement>
          <BigButton icon={<LineHorizontal3Regular />} tip={disabled ? "Size (pick a drawing tool)" : `Size: ${size}px`} disabled={disabled} />
        </PopoverTrigger>
        <PopoverSurface className="size-surface">
          <div className="size-head">
            <span>Size</span>
            <span className="size-value">{size}px</span>
          </div>
          <Slider min={1} max={group === "pencil" ? 20 : 100} value={size} onChange={(_, d) => editor.setSize(d.value)} />
          <div className="size-presets">
            {SIZE_PRESETS[group].map((px) => (
              <button key={px} className={`size-preset${px === size ? " active" : ""}`} onClick={() => editor.setSize(px)} aria-label={`${px}px`}>
                <SizeLine px={px} />
              </button>
            ))}
          </div>
        </PopoverSurface>
      </Popover>
    </RibbonGroup>
  );
}
