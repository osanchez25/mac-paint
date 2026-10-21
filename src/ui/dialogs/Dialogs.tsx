import { Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle } from "@fluentui/react-components";

import { useEditor, usePaint } from "../app-context";
import { EditColorsDialog } from "./EditColorsDialog";
import { PropertiesDialog } from "./PropertiesDialog";
import { ResizeDialog } from "./ResizeDialog";
import { SaveSmallerDialog } from "./SaveSmallerDialog";

export function Dialogs() {
  const dialog = useEditor((s) => s.dialog);
  switch (dialog) {
    case "resize": return <ResizeDialog />;
    case "properties": return <PropertiesDialog />;
    case "editColors": return <EditColorsDialog />;
    case "unsaved": return <UnsavedDialog />;
    case "about": return <AboutDialog />;
    case "saveSmaller": return <SaveSmallerDialog />;
    default: return null;
  }
}

/** Paint's question before closing or replacing a changed picture. */
function UnsavedDialog() {
  const { files } = usePaint();
  const name = useEditor((s) => s.file.name);
  return (
    <Dialog open modalType="alert" onOpenChange={(_, d) => !d.open && files.answerUnsaved("cancel")}>
      <DialogSurface className="paint-dialog small">
        <DialogBody>
          <DialogTitle>Paint</DialogTitle>
          <DialogContent>Do you want to save changes to {name}?</DialogContent>
          <DialogActions>
            <Button appearance="primary" onClick={() => files.answerUnsaved("save")}>Save</Button>
            <Button onClick={() => files.answerUnsaved("discard")}>Don't save</Button>
            <Button onClick={() => files.answerUnsaved("cancel")}>Cancel</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function AboutDialog() {
  const { editor } = usePaint();
  const close = () => editor.set({ dialog: null });
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && close()}>
      <DialogSurface className="paint-dialog small">
        <DialogBody>
          <DialogTitle>Paint for Mac</DialogTitle>
          <DialogContent>
            A Mac version of the Windows 11 Paint app. Version 0.1.1.
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" onClick={close}>OK</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
