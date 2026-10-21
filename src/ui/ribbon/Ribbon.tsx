import { Menu, MenuDivider, MenuGroup, MenuGroupHeader, MenuItem, MenuList, MenuPopover, MenuTrigger } from "@fluentui/react-components";
import {
  ArrowRotateClockwiseRegular,
  ArrowRotateCounterclockwiseRegular,
  CheckmarkRegular,
  CropRegular,
  DeleteRegular,
  EditRegular,
  EraserRegular,
  EyedropperRegular,
  FlipHorizontalRegular,
  FlipVerticalRegular,
  LayerRegular,
  LassoRegular,
  PaintBucketRegular,
  ResizeImageRegular,
  SelectAllOnRegular,
  SelectAllOffRegular,
  SelectObjectRegular,
  TextTRegular,
  VideoBackgroundEffectRegular,
  ZoomInRegular,
} from "@fluentui/react-icons";

import type { ToolId } from "../../editor/state";
import { useEditor, usePaint } from "../app-context";
import { BrushesGroup, ShapesGroup, SizeGroup } from "./DrawGroups";
import { ColorsGroup } from "./ColorsGroup";
import { BigSplit, ChevronButton, RibbonGroup, SplitSmallButton, ToolButton, ToolButtonLarge } from "./parts";

/** Paint's toolbar: Selection · Image · Tools · Brushes · Shapes · Size · Colors. */
export function Ribbon() {
  return (
    <div className="ribbon">
      <SelectionGroup />
      <ImageGroup />
      <ToolsGroup />
      <BrushesGroup />
      <ShapesGroup />
      <SizeGroup />
      <ColorsGroup />
      <LayersGroup />
    </div>
  );
}

/** Opens and closes the Layers panel, like Paint's Layers button. */
function LayersGroup() {
  const { layers } = usePaint();
  const open = useEditor((s) => s.layersPanel);
  return (
    <RibbonGroup label="Layers">
      <ToolButtonLarge icon={<LayerRegular />} tip={open ? "Hide layers" : "Show layers"} active={open} onClick={() => layers.togglePanel()} />
    </RibbonGroup>
  );
}

function SelectionGroup() {
  const { editor, image } = usePaint();
  const active = useEditor((s) => s.tool === "select");
  const mode = useEditor((s) => s.selectMode);
  const transparent = useEditor((s) => s.transparentSelection);
  const hasSelection = useEditor((s) => s.hasSelection);
  const check = (on: boolean) => (on ? <CheckmarkRegular /> : <span />);
  const pickMode = (m: "rectangle" | "freeform") => {
    editor.set({ selectMode: m });
    editor.setTool("select");
  };

  return (
    <RibbonGroup label="Selection">
      <BigSplit
        icon={mode === "freeform" ? <LassoRegular /> : <SelectObjectRegular />}
        tip={mode === "freeform" ? "Free-form selection" : "Rectangular selection"}
        active={active}
        onClick={() => editor.setTool("select")}
      >
      <Menu positioning="below-start">
        <MenuTrigger disableButtonEnhancement>
          <ChevronButton label="Selection options" />
        </MenuTrigger>
        <MenuPopover>
          <MenuList>
            <MenuGroup>
              <MenuGroupHeader>Selection shapes</MenuGroupHeader>
              <MenuItem icon={<SelectObjectRegular />} secondaryContent={check(mode === "rectangle")} onClick={() => pickMode("rectangle")}>
                Rectangle
              </MenuItem>
              <MenuItem icon={<LassoRegular />} secondaryContent={check(mode === "freeform")} onClick={() => pickMode("freeform")}>
                Free-form
              </MenuItem>
            </MenuGroup>
            <MenuDivider />
            <MenuGroup>
              <MenuGroupHeader>Selection options</MenuGroupHeader>
              <MenuItem icon={<SelectAllOnRegular />} secondaryContent="⌘A" onClick={() => image.selectAll()}>Select all</MenuItem>
              <MenuItem icon={<SelectAllOffRegular />} secondaryContent="⇧⌘I" onClick={() => image.invertSelection()}>
                Invert selection
              </MenuItem>
              <MenuItem icon={<DeleteRegular />} secondaryContent="Delete" disabled={!hasSelection} onClick={() => image.deleteSelection()}>
                Delete selection
              </MenuItem>
              <MenuItem
                icon={check(transparent)}
                onClick={() => {
                  editor.set({ transparentSelection: !transparent });
                  editor.refreshTool();
                }}
              >
                Transparent selection
              </MenuItem>
            </MenuGroup>
          </MenuList>
        </MenuPopover>
      </Menu>
      </BigSplit>
    </RibbonGroup>
  );
}

function ImageGroup() {
  const { editor, image } = usePaint();
  const hasSelection = useEditor((s) => s.hasSelection);
  const busy = useEditor((s) => s.busy !== null);
  return (
    <RibbonGroup label="Image">
      <div className="tool-grid cols-3">
        <ToolButton icon={<CropRegular />} tip="Crop (⇧⌘X)" disabled={!hasSelection} onClick={() => image.crop()} />
        <Menu positioning="below-start">
          <MenuTrigger disableButtonEnhancement>
            <SplitSmallButton icon={<ArrowRotateClockwiseRegular />} tip="Rotate" />
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              <MenuItem icon={<ArrowRotateClockwiseRegular />} onClick={() => image.rotate(90)}>Rotate right 90°</MenuItem>
              <MenuItem icon={<ArrowRotateCounterclockwiseRegular />} onClick={() => image.rotate(-90)}>Rotate left 90°</MenuItem>
              <MenuItem icon={<ArrowRotateClockwiseRegular />} onClick={() => image.rotate(180)}>Rotate 180°</MenuItem>
            </MenuList>
          </MenuPopover>
        </Menu>
        <ToolButton
          icon={<VideoBackgroundEffectRegular />}
          tip={hasSelection ? "Remove background from the selection" : "Remove background"}
          disabled={busy}
          onClick={() => void image.removeBackground()}
        />
        <ToolButton icon={<ResizeImageRegular />} tip="Resize and skew (⌃W)" onClick={() => editor.set({ dialog: "resize" })} />
        <Menu positioning="below-start">
          <MenuTrigger disableButtonEnhancement>
            <SplitSmallButton icon={<FlipHorizontalRegular />} tip="Flip" />
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              <MenuItem icon={<FlipVerticalRegular />} onClick={() => image.flip("vertical")}>Flip vertical</MenuItem>
              <MenuItem icon={<FlipHorizontalRegular />} onClick={() => image.flip("horizontal")}>Flip horizontal</MenuItem>
            </MenuList>
          </MenuPopover>
        </Menu>
      </div>
    </RibbonGroup>
  );
}

const TOOLS: { id: ToolId; tip: string; icon: React.ReactNode }[] = [
  { id: "pencil", tip: "Pencil", icon: <EditRegular /> },
  { id: "fill", tip: "Fill", icon: <PaintBucketRegular /> },
  { id: "text", tip: "Text", icon: <TextTRegular /> },
  { id: "eraser", tip: "Eraser", icon: <EraserRegular /> },
  { id: "picker", tip: "Color picker", icon: <EyedropperRegular /> },
  { id: "magnifier", tip: "Magnifier", icon: <ZoomInRegular /> },
];

function ToolsGroup() {
  const { editor } = usePaint();
  const tool = useEditor((s) => s.tool);
  return (
    <RibbonGroup label="Tools">
      <div className="tool-grid cols-3">
        {TOOLS.map((t) => (
          <ToolButton key={t.id} icon={t.icon} tip={t.tip} active={tool === t.id} onClick={() => editor.setTool(t.id)} />
        ))}
      </div>
    </RibbonGroup>
  );
}
