import { Menu, MenuDivider, MenuItem, MenuList, MenuPopover, MenuTrigger, Tooltip } from "@fluentui/react-components";
import {
  AddRegular,
  ArrowDownRegular,
  ArrowUpRegular,
  CopyRegular,
  DeleteRegular,
  EyeOffRegular,
  EyeRegular,
  LayerDiagonalRegular,
  MoreHorizontalRegular,
} from "@fluentui/react-icons";
import { useEffect, useRef, useState } from "react";

import type { LayerInfo } from "../editor/state";
import { useEditor, usePaint } from "./app-context";

/** Paint's Layers panel: newest layer on top; click to pick, drag to reorder, ⋯ for more. */
export function LayersPanel() {
  const { layers } = usePaint();
  const list = useEditor((s) => s.layers);
  const active = useEditor((s) => s.activeLayer);
  const [dragId, setDragId] = useState<string | null>(null);
  const top = [...list].reverse();

  return (
    <aside className="layers-panel" aria-label="Layers">
      <div className="layers-head">
        <span>Layers</span>
        <Tooltip content="Add layer" relationship="label" positioning="below">
          <button className="icon-btn small" onClick={() => layers.add()} aria-label="Add layer">
            <AddRegular />
          </button>
        </Tooltip>
      </div>
      <div className="layers-list">
        {top.map((info) => {
          const index = list.findIndex((l) => l.id === info.id);
          return (
            <LayerCard
              key={info.id}
              info={info}
              index={index}
              count={list.length}
              active={info.id === active}
              dragging={dragId === info.id}
              onDragStart={() => setDragId(info.id)}
              onDragEnd={() => setDragId(null)}
              onDropHere={() => {
                if (dragId) layers.move(dragId, index);
                setDragId(null);
              }}
            />
          );
        })}
      </div>
    </aside>
  );
}

interface CardProps {
  info: LayerInfo;
  /** Position from the bottom (0 = bottom layer). */
  index: number;
  count: number;
  active: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropHere: () => void;
}

function LayerCard({ info, index, count, active, dragging, onDragStart, onDragEnd, onDropHere }: CardProps) {
  const { layers } = usePaint();
  const [over, setOver] = useState(false);
  return (
    <div
      className={`layer-card${active ? " active" : ""}${dragging ? " dragging" : ""}${over ? " drop" : ""}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        onDropHere();
      }}
      onClick={() => layers.select(info.id)}
      aria-label={info.name}
      aria-current={active}
    >
      <Thumbnail id={info.id} />
      <div className="layer-actions">
        <Tooltip content={info.visible ? "Hide layer" : "Show layer"} relationship="label" positioning="below">
          <button
            className={`layer-btn${info.visible ? "" : " off"}`}
            onClick={(e) => {
              e.stopPropagation();
              layers.toggleVisible(info.id);
            }}
          >
            {info.visible ? <EyeRegular /> : <EyeOffRegular />}
          </button>
        </Tooltip>
        <Menu positioning="below-end">
          <MenuTrigger disableButtonEnhancement>
            <button className="layer-btn" aria-label="Layer options" onClick={(e) => { e.stopPropagation(); layers.select(info.id); }}>
              <MoreHorizontalRegular />
            </button>
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              <MenuItem icon={<CopyRegular />} onClick={() => layers.duplicate()}>Duplicate layer</MenuItem>
              <MenuItem icon={<LayerDiagonalRegular />} disabled={index === 0} onClick={() => layers.mergeDown()}>Merge down</MenuItem>
              <MenuItem icon={<DeleteRegular />} disabled={count < 2} onClick={() => layers.remove()}>Delete layer</MenuItem>
              <MenuDivider />
              <MenuItem icon={<ArrowUpRegular />} disabled={index === count - 1} onClick={() => layers.move(info.id, index + 1)}>Move up</MenuItem>
              <MenuItem icon={<ArrowDownRegular />} disabled={index === 0} onClick={() => layers.move(info.id, index - 1)}>Move down</MenuItem>
              <MenuItem icon={info.visible ? <EyeOffRegular /> : <EyeRegular />} onClick={() => layers.toggleVisible(info.id)}>
                {info.visible ? "Hide layer" : "Show layer"}
              </MenuItem>
            </MenuList>
          </MenuPopover>
        </Menu>
      </div>
    </div>
  );
}

const THUMB_W = 136;
const THUMB_H = 84;

/** Small copy of the layer, redrawn whenever pixels are committed. */
function Thumbnail({ id }: { id: string }) {
  const { editor } = usePaint();
  const version = useEditor((s) => s.pixelsVersion);
  const width = useEditor((s) => s.width);
  const height = useEditor((s) => s.height);
  const ref = useRef<HTMLCanvasElement>(null);
  const scale = Math.min(THUMB_W / width, THUMB_H / height);
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  useEffect(() => {
    const c = ref.current;
    const layer = editor.doc.layers.find((l) => l.id === id);
    if (!c || !layer) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(layer.canvas, 0, 0, c.width, c.height);
  }, [editor, id, version, w, h]);

  return (
    <div className="layer-thumb">
      <canvas ref={ref} style={{ width: w, height: h }} />
    </div>
  );
}
