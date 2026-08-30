import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { PixiMVPDemo } from "./core/PixiMVPDemo";

// Load các thư viện từ NPM thay vì CDN (CDN bị chặn -> app bị trắng màn hình)
// Dockview: Thư viện layout cho editor
import "dockview/dist/styles/dockview.css";
import * as dockviewModule from "dockview";
(window as unknown as { dockview: typeof dockviewModule }).dockview = dockviewModule;

// PixiJS: Engine game 2D
import * as PIXI from "pixi.js";
(window as unknown as { PIXI: typeof PIXI }).PIXI = PIXI;

// CodeMirror: Editor script trong app
// @ts-ignore - Bỏ qua lỗi type cho CodeMirror (cần thêm types riêng nếu cần)
import CodeMirror from "codemirror";
import "codemirror/lib/codemirror.css";
import "codemirror/theme/monokai.css";
import "codemirror/mode/javascript/javascript.js";
(window as unknown as { CodeMirror: typeof CodeMirror }).CodeMirror = CodeMirror;

// Khởi tạo đối tượng gameEditor toàn cục (tránh TypeError khi App.tsx gán emit/on)
(window as unknown as {
  gameEditor: {
    pixiApp: unknown;
    sceneManager: unknown;
    viewport: unknown;
    emit: (event: string, data?: unknown) => void;
    on: (event: string, callback: (data: unknown) => void) => void;
  };
}).gameEditor = {
  pixiApp: null,
  sceneManager: null,
  viewport: null,
  emit: () => {},
  on: () => {},
};

// Render ứng dụng React
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

// Khởi chạy demo PixiJS MVP sau khi React đã mount hoàn tất
// Đợi 100ms để đảm bảo DOM đã sẵn sàng trước khi khởi tạo PIXI.Application
setTimeout(() => {
  new PixiMVPDemo(rootElement);
}, 100);