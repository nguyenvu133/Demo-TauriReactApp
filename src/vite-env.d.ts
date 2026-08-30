/// <reference types="vite/client" />

// Định nghĩa global cho game editor
declare global {
  interface Window {
    PIXI: any;
    gameEditor: {
      pixiApp: any;
      sceneManager: any;
      viewport: any;
    };
  }
}

// Khởi tạo gameEditor nếu chưa tồn tại
if (!window.gameEditor) {
  window.gameEditor = {
    pixiApp: null,
    sceneManager: null,
    viewport: null
  };
}

export {};