import { FluentProvider, webDarkTheme, webLightTheme } from "@fluentui/react-components";
import React, { useSyncExternalStore } from "react";
import ReactDOM from "react-dom/client";

import { PaintApp } from "./editor/paint-app";
import { detectPlatform } from "./platform";
import { App } from "./ui/App";
import { AppContext } from "./ui/app-context";
import "./ui/styles.css";

const app = new PaintApp(detectPlatform());
// Handy in the dev tools: `paint.editor.state`.
if (import.meta.env.DEV) Object.assign(window, { paint: app });

const dark = window.matchMedia("(prefers-color-scheme: dark)");
const subscribeDark = (cb: () => void) => {
  dark.addEventListener("change", cb);
  return () => dark.removeEventListener("change", cb);
};

/** Follows the Mac's light/dark appearance, like Paint follows Windows. */
function Root() {
  const isDark = useSyncExternalStore(subscribeDark, () => dark.matches);
  return (
    <FluentProvider theme={isDark ? webDarkTheme : webLightTheme}>
      <AppContext.Provider value={app}>
        <App />
      </AppContext.Provider>
    </FluentProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
