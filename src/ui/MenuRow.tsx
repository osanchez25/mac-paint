import { Menu, MenuDivider, MenuItem, MenuList, MenuPopover, MenuTrigger, Tooltip } from "@fluentui/react-components";
import {
  ArrowRedoRegular,
  ArrowUndoRegular,
  CheckmarkRegular,
  SaveRegular,
} from "@fluentui/react-icons";

import { FORMAT_LABELS, type ImageFormat } from "../platform/platform";
import { useEditor, usePaint } from "./app-context";

const FORMATS: ImageFormat[] = ["png", "jpeg", "bmp", "gif"];

/** File, Edit and View menus, Save, Undo and Redo: the row above Paint's toolbar. */
export function MenuRow() {
  const app = usePaint();
  const { editor, files, image } = app;
  const canUndo = useEditor((s) => s.canUndo || s.hasSelection || s.editingShape || s.textBox !== null);
  const canRedo = useEditor((s) => s.canRedo);
  const hasSelection = useEditor((s) => s.hasSelection);
  const view = useEditor((s) => s.view);
  const setView = (patch: Partial<typeof view>) => editor.set({ view: { ...view, ...patch } });

  return (
    <div className="menu-row">
      <Menu>
        <MenuTrigger disableButtonEnhancement>
          <button className="menu-title">File</button>
        </MenuTrigger>
        <MenuPopover>
          <MenuList>
            <MenuItem secondaryContent="⌘N" onClick={() => void files.newPicture()}>New</MenuItem>
            <MenuItem secondaryContent="⌘O" onClick={() => void files.open()}>Open</MenuItem>
            <MenuItem secondaryContent="⌘S" onClick={() => void files.save()}>Save</MenuItem>
            <Menu>
              <MenuTrigger disableButtonEnhancement>
                <MenuItem>Save as</MenuItem>
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  {FORMATS.map((f) => (
                    <MenuItem key={f} secondaryContent={f === "png" ? "⇧⌘S" : undefined} onClick={() => void files.saveAs(f)}>
                      {FORMAT_LABELS[f]}
                    </MenuItem>
                  ))}
                </MenuList>
              </MenuPopover>
            </Menu>
            <MenuItem onClick={() => editor.set({ dialog: "saveSmaller" })}>Save a smaller copy…</MenuItem>
            <MenuDivider />
            <MenuItem secondaryContent="⌘P" onClick={() => void files.print()}>Print</MenuItem>
            <MenuDivider />
            <MenuItem secondaryContent="⌘E" onClick={() => editor.set({ dialog: "properties" })}>Image properties</MenuItem>
            <MenuItem onClick={() => editor.set({ dialog: "about" })}>About Paint</MenuItem>
            <MenuDivider />
            <MenuItem secondaryContent="⌘Q" onClick={() => void app.exit()}>Exit</MenuItem>
          </MenuList>
        </MenuPopover>
      </Menu>

      <Menu>
        <MenuTrigger disableButtonEnhancement>
          <button className="menu-title">Edit</button>
        </MenuTrigger>
        <MenuPopover>
          <MenuList>
            <MenuItem secondaryContent="⌘Z" disabled={!canUndo} onClick={() => editor.undo()}>Undo</MenuItem>
            <MenuItem secondaryContent="⌘Y" disabled={!canRedo} onClick={() => editor.redo()}>Redo</MenuItem>
            <MenuDivider />
            <MenuItem secondaryContent="⌘X" disabled={!hasSelection} onClick={() => void image.cut()}>Cut</MenuItem>
            <MenuItem secondaryContent="⌘C" disabled={!hasSelection} onClick={() => void image.copy()}>Copy</MenuItem>
            <MenuItem secondaryContent="⌘V" onClick={() => void image.paste()}>Paste</MenuItem>
          </MenuList>
        </MenuPopover>
      </Menu>

      <Menu>
        <MenuTrigger disableButtonEnhancement>
          <button className="menu-title">View</button>
        </MenuTrigger>
        <MenuPopover>
          <MenuList>
            <MenuItem secondaryContent="⌘+" onClick={() => editor.zoomStep(1)}>Zoom in</MenuItem>
            <MenuItem secondaryContent="⌘−" onClick={() => editor.zoomStep(-1)}>Zoom out</MenuItem>
            <MenuItem secondaryContent="⌘0" onClick={() => editor.setZoom(1)}>Zoom to 100%</MenuItem>
            <MenuItem secondaryContent="⌘9" onClick={() => editor.zoomToFit()}>Fit to window</MenuItem>
            <MenuDivider />
            <MenuItem secondaryContent="⌘G" icon={view.gridlines ? <CheckmarkRegular /> : <span />} onClick={() => setView({ gridlines: !view.gridlines })}>
              Gridlines
            </MenuItem>
            <MenuItem icon={view.statusBar ? <CheckmarkRegular /> : <span />} onClick={() => setView({ statusBar: !view.statusBar })}>
              Status bar
            </MenuItem>
            <MenuItem secondaryContent="F11" icon={view.fullscreen ? <CheckmarkRegular /> : <span />} onClick={() => void app.toggleFullscreen()}>
              Full screen
            </MenuItem>
          </MenuList>
        </MenuPopover>
      </Menu>

      <span className="menu-sep" />
      <Tooltip content="Save (⌘S)" relationship="label" positioning="below">
        <button className="icon-btn" onClick={() => void files.save()}>
          <SaveRegular />
        </button>
      </Tooltip>
      <span className="menu-sep" />
      <Tooltip content="Undo (⌘Z)" relationship="label" positioning="below">
        <button className="icon-btn" disabled={!canUndo} onClick={() => editor.undo()}>
          <ArrowUndoRegular />
        </button>
      </Tooltip>
      <Tooltip content="Redo (⌘Y)" relationship="label" positioning="below">
        <button className="icon-btn" disabled={!canRedo} onClick={() => editor.redo()}>
          <ArrowRedoRegular />
        </button>
      </Tooltip>
    </div>
  );
}
