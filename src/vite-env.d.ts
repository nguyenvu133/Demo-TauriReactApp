/// <reference types="vite/client" />

declare module "codemirror";

declare global {
  interface Window {
    PIXI: any;
    CodeMirror: any;
    dockview: any;
    gameEditor: {
      pixiApp: any;
      sceneManager: any;
      viewport: any;
      emit: (event: string, data?: any) => void;
      on: (event: string, callback: (data: any) => void) => void;
      off: (event: string, callback: (data: any) => void) => void;
    };
  }
}

export {};
