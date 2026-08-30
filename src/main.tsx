import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Dockview CSS
import "dockview/dist/styles/dockview.css";
import * as dockviewModule from "dockview";
(window as unknown as { dockview: typeof dockviewModule }).dockview = dockviewModule;

// PixiJS
import * as PIXI from "pixi.js";
(window as unknown as { PIXI: typeof PIXI }).PIXI = PIXI;

// CodeMirror
import CodeMirror from "codemirror";
import "codemirror/lib/codemirror.css";
import "codemirror/theme/monokai.css";
import "codemirror/mode/javascript/javascript.js";
(window as unknown as { CodeMirror: typeof CodeMirror }).CodeMirror = CodeMirror;

// Render App
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Không tìm thấy element #root trong DOM");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
