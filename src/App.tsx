import { useEffect, useState } from "react";
import { DockviewReact, DockviewReadyEvent, IDockviewPanelProps } from "dockview";
import "./App.css";
import { GamePanel } from "./components/panels/GamePanel.tsx";
import { AssetsPanel } from "./components/panels/AssetsPanel.tsx";
import { InspectorPanel } from "./components/panels/InspectorPanel.tsx";
import { HierarchyPanel } from "./components/panels/HierarchyPanel.tsx";
import { ConsolePanel } from "./components/panels/ConsolePanel.tsx";

// Global type declarations
declare global {
  interface Window {
    dockview: any;
    PIXI: any;
    CodeMirror: any;
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

// Initialize global event emitter
const eventTarget = new EventTarget();
if (typeof window !== "undefined") {
  window.gameEditor = {
    pixiApp: null,
    sceneManager: null,
    viewport: null,
    emit: (event: string, data?: any) => {
      eventTarget.dispatchEvent(new CustomEvent(event, { detail: data }));
      window.dispatchEvent(new CustomEvent(event, { detail: data }));
    },
    on: (event: string, callback: (data: any) => void) => {
      eventTarget.addEventListener(event, (e: any) => callback(e.detail));
    },
    off: (event: string, callback: (data: any) => void) => {
      eventTarget.removeEventListener(event, (e: any) => callback(e.detail));
    },
  };
}

const components: Record<string, React.FunctionComponent<IDockviewPanelProps>> = {
  game: () => <GamePanel />,
  assets: () => <AssetsPanel />,
  inspector: () => <InspectorPanel />,
  hierarchy: () => <HierarchyPanel />,
  console: () => <ConsolePanel />,
};

function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentProjectName] = useState("MyPixiGame");
  const [fps, setFps] = useState(60);

  useEffect(() => {
    const fpsCounter = setInterval(() => {
      if (window.gameEditor?.pixiApp?.ticker) {
        setFps(Math.round(window.gameEditor.pixiApp.ticker.FPS));
      }
    }, 1000);

    return () => clearInterval(fpsCounter);
  }, []);

  const onReady = (event: DockviewReadyEvent) => {
    const api = event.api;

    // Center panel: Game View
    const gamePanel = api.addPanel({
      id: "game-canvas",
      component: "game",
      title: "Game View",
    });

    // Left panel: Assets
    const assetsPanel = api.addPanel({
      id: "assets",
      component: "assets",
      title: "Assets",
      position: { referencePanel: gamePanel, direction: "left" },
    });

    // Top-left panel: Hierarchy (above Assets)
    api.addPanel({
      id: "hierarchy",
      component: "hierarchy",
      title: "Hierarchy",
      position: { referencePanel: assetsPanel, direction: "above" },
    });

    // Right panel: Inspector
    api.addPanel({
      id: "inspector",
      component: "inspector",
      title: "Inspector",
      position: { referencePanel: gamePanel, direction: "right" },
    });

    // Bottom panel: Console (below Game View)
    api.addPanel({
      id: "console",
      component: "console",
      title: "Console",
      position: { referencePanel: gamePanel, direction: "below" },
    });

    console.log("🎮 Game editor initialized with professional Dockview layout!");
  };

  const handlePlay = () => {
    setIsPlaying(!isPlaying);
    if (window.gameEditor?.pixiApp?.ticker) {
      isPlaying ? window.gameEditor.pixiApp.stop() : window.gameEditor.pixiApp.start();
    }
  };

  const handleSave = () => {
    window.gameEditor?.emit("saveProject");
    console.log("💾 Project saved!");
  };

  return (
    <div className="w-screen h-screen flex flex-col bg-gray-950 overflow-hidden" style={{ width: "100vw", height: "100vh" }}>
      {/* Top Menu Bar */}
      <header className="h-9 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-1 text-sm shrink-0">
        <span className="font-bold text-blue-400 mr-4">PixiJS Editor</span>
        <button className="px-3 py-1 hover:bg-gray-800 rounded text-gray-300">File</button>
        <button className="px-3 py-1 hover:bg-gray-800 rounded text-gray-300">Edit</button>
        <button className="px-3 py-1 hover:bg-gray-800 rounded text-gray-300">View</button>
        <button className="px-3 py-1 hover:bg-gray-800 rounded text-gray-300">GameObject</button>
        <button className="px-3 py-1 hover:bg-gray-800 rounded text-gray-300">Window</button>
        <button className="px-3 py-1 hover:bg-gray-800 rounded text-gray-300">Help</button>
      </header>

      {/* Main Toolbar */}
      <div className="h-12 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-2 shrink-0">
        <button
          onClick={handlePlay}
          className={`w-9 h-9 flex items-center justify-center rounded ${isPlaying ? "bg-red-600 hover:bg-red-500" : "bg-green-600 hover:bg-green-500"} text-white transition-colors`}
          title={isPlaying ? "Stop (Ctrl+P)" : "Play (Ctrl+P)"}
        >
          {isPlaying ? "⏹" : "▶"}
        </button>
        
        <button
          onClick={() => window.gameEditor?.pixiApp?.ticker?.stop()}
          className="w-9 h-9 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors"
          title="Pause (Ctrl+Shift+P)"
        >
          ⏸
        </button>

        <div className="w-px h-6 bg-gray-700 mx-2" />

        <button
          onClick={handleSave}
          className="w-9 h-9 flex items-center justify-center rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          title="Save Project (Ctrl+S)"
        >
          💾
        </button>

        <div className="w-px h-6 bg-gray-700 mx-2" />

        <button className="w-9 h-9 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors" title="Select (V)">
          👆
        </button>
        <button className="w-9 h-9 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors" title="Move">
          ✋
        </button>
        <button className="w-9 h-9 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors" title="Scale (R)">
          ⤡
        </button>
        <button className="w-9 h-9 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors" title="Rotate (E)">
          ↺
        </button>

        <div className="ml-auto flex items-center gap-2 text-gray-400 text-sm">
          <span>📁 {currentProjectName}</span>
        </div>
      </div>

      {/* Main Dockview Container */}
      <main className="flex-1 w-full relative overflow-hidden" style={{ minHeight: 0 }}>
        <DockviewReact
          components={components}
          onReady={onReady}
          className="dockview-theme-dark"
        />
      </main>

      {/* Bottom Status Bar */}
      <footer className="h-6 bg-blue-700 flex items-center px-4 text-xs text-white justify-between shrink-0">
        <div className="flex items-center gap-4">
          <span>🎮 {isPlaying ? "Playing" : "Stopped"}</span>
          <span>⚡ {fps} FPS</span>
        </div>
        <div className="flex items-center gap-4">
          <span>🌐 PixiJS v{window.PIXI?.VERSION || "7.x"}</span>
          <span>🖥️ Tauri React App</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
