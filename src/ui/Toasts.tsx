import { Button, MessageBar, MessageBarActions, MessageBarBody, Spinner } from "@fluentui/react-components";
import { DismissRegular } from "@fluentui/react-icons";
import { useEffect } from "react";

import { useEditor, usePaint } from "./app-context";

/** Errors stay until dismissed; success notes fade after a few seconds. */
export function MessageToast() {
  const { editor } = usePaint();
  const message = useEditor((s) => s.message);
  useEffect(() => {
    if (message?.intent !== "success") return;
    const t = window.setTimeout(() => editor.set({ message: null }), 4000);
    return () => window.clearTimeout(t);
  }, [message, editor]);
  if (!message) return null;
  return (
    <div className="toast">
      <MessageBar intent={message.intent}>
        <MessageBarBody>{message.text}</MessageBarBody>
        <MessageBarActions
          containerAction={<Button appearance="transparent" icon={<DismissRegular />} aria-label="Dismiss" onClick={() => editor.set({ message: null })} />}
        />
      </MessageBar>
    </div>
  );
}

/** Shown while a slow command runs (Remove background), like Paint's progress card. */
export function BusyOverlay() {
  const busy = useEditor((s) => s.busy);
  if (!busy) return null;
  return (
    <div className="busy" role="status">
      <div className="busy-card">
        <Spinner size="small" />
        <span>{busy}…</span>
      </div>
    </div>
  );
}
