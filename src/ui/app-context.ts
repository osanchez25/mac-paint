import { createContext, useContext, useSyncExternalStore } from "react";

import type { PaintApp } from "../editor/paint-app";
import type { EditorState } from "../editor/state";

export const AppContext = createContext<PaintApp | null>(null);

export function usePaint(): PaintApp {
  const app = useContext(AppContext);
  if (!app) throw new Error("usePaint must be used inside <AppContext.Provider>");
  return app;
}

/** Subscribes to one slice of the editor state; re-renders only when it changes. */
export function useEditor<T>(select: (s: EditorState) => T): T {
  const { editor } = usePaint();
  return useSyncExternalStore(editor.store.subscribe, () => select(editor.store.get()));
}
