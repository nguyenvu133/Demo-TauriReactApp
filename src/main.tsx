import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Load thư viện qua npm thay vì CDN (CDN bị chặn -> app trắng màn hình)
// Dockview: layout editor
import "dockview/dist/styles/dockview.css";
import * as dockviewModule from "dockview";
(window as any).dockview = dockviewModule;

// PixiJS: engine 2D
import * as PIXI from "pixi.js";
(window as any).PIXI = PIXI;

// CodeMirror (Script Editor)
// @ts-ignore
import CodeMirror from "codemirror";
import "codemirror/lib/codemirror.css";
import "codemirror/theme/monokai.css";
import "codemirror/mode/javascript/javascript.js";
(window as any).CodeMirror = CodeMirror;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);