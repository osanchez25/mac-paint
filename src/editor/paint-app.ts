import type { Platform } from "../platform/platform";
import { FileActions } from "./actions/file-actions";
import { ImageActions } from "./actions/image-actions";
import { LayerActions } from "./actions/layer-actions";
import { Editor } from "./editor";
import { Selection } from "./selection";
import { FreehandTool } from "./tools/freehand";
import { SelectTool } from "./tools/select-tool";
import { ShapeTool } from "./tools/shape-tool";
import { FillTool, MagnifierTool, PickerTool } from "./tools/simple-tools";
import { TextTool } from "./tools/text-tool";

/** Wires the editor, its tools and the commands to one platform. The UI gets this one object. */
export class PaintApp {
  readonly editor = new Editor();
  readonly selection = new Selection(this.editor);
  readonly text = new TextTool(this.editor);
  readonly files: FileActions;
  readonly image: ImageActions;
  readonly layers: LayerActions;

  constructor(readonly platform: Platform) {
    const ed = this.editor;
    ed.registerTool(new SelectTool(ed, this.selection));
    ed.registerTool(new FreehandTool(ed, "pencil"));
    ed.registerTool(new FreehandTool(ed, "brush"));
    ed.registerTool(new FreehandTool(ed, "eraser"));
    ed.registerTool(new FillTool(ed));
    ed.registerTool(new PickerTool(ed));
    ed.registerTool(new MagnifierTool(ed));
    ed.registerTool(new ShapeTool(ed));
    ed.registerTool(this.text);
    this.files = new FileActions(ed, platform);
    this.image = new ImageActions(ed, this.selection, platform);
    this.layers = new LayerActions(ed);

    platform.onOpenFiles((paths) => void this.files.openPaths(paths));
    platform.onCloseRequested(() => this.files.confirmDiscard());
    platform.onQuitRequested(() => void this.exit());
    this.keepTitle();
  }

  /** File > Exit and Cmd+Q: asks to save, then closes. */
  async exit(): Promise<void> {
    if (await this.files.confirmDiscard()) await this.platform.closeWindow();
  }

  async toggleFullscreen(): Promise<void> {
    const view = this.editor.state.view;
    const on = !view.fullscreen;
    await this.platform.setFullscreen(on);
    this.editor.set({ view: { ...view, fullscreen: on } });
  }

  private keepTitle(): void {
    let last = "";
    const update = () => {
      const s = this.editor.state;
      const title = `${s.dirty ? "* " : ""}${s.file.name} - Paint`;
      if (title !== last) this.platform.setTitle((last = title));
    };
    this.editor.store.subscribe(update);
    update();
  }
}
