import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./App.css";
import { GamePanel } from "./components/panels/GamePanel.tsx";
import { AssetsPanel } from "./components/panels/AssetsPanel.tsx";
import { InspectorPanel } from "./components/panels/InspectorPanel.tsx";
import { HierarchyPanel } from "./components/panels/HierarchyPanel.tsx";
import { ConsolePanel } from "./components/panels/ConsolePanel.tsx";

// Khai báo các thư viện toàn cục được load từ CDN
declare global {
  interface Window {
    dockview: any;
    PIXI: any;
    gameEditor: {
      pixiApp: any;
      sceneManager: any;
      viewport: any;
      emit: (event: string, data?: any) => void;
      on: (event: string, callback: (data: any) => void) => void;
    };
  }
}

function App() {
  const appContainerRef = useRef<HTMLDivElement>(null);
  const [isEditorInitialized, setIsEditorInitialized] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentProjectName] = useState("MyPixiGame");
  const [fps, setFps] = useState(60);

  useEffect(() => {
    if (!appContainerRef.current || isEditorInitialized) return;

    // Khởi tạo event emitter cho gameEditor
    const eventTarget = new EventTarget();
    window.gameEditor.emit = (event: string, data?: any) => {
      eventTarget.dispatchEvent(new CustomEvent(event, { detail: data }));
    };
    window.gameEditor.on = (event: string, callback: (data: any) => void) => {
      eventTarget.addEventListener(event, (e: any) => callback(e.detail));
    };

    // Đợi tất cả script CDN load xong trước khi khởi tạo editor
    const waitForScriptsAndInit = () => {
      if (typeof window.dockview !== 'undefined' && typeof window.PIXI !== 'undefined') {
        console.log('✅ All CDN scripts loaded, initializing editor...');
        initGameEditor();
        setIsEditorInitialized(true);
      } else {
        console.log('⏳ Waiting for CDN scripts to load...');
        setTimeout(waitForScriptsAndInit, 500);
      }
    };

    // Theo dõi FPS
    const fpsCounter = setInterval(() => {
      if (window.gameEditor.pixiApp?.ticker) {
        setFps(Math.round(window.gameEditor.pixiApp.ticker.FPS));
      }
    }, 1000);

    return () => clearInterval(fpsCounter);
  }, [isEditorInitialized]);

  function initGameEditor() {
    if (!appContainerRef.current) return;

    // 🎨 Cấu hình Dockview layout chuyên nghiệp
    const dockview = new window.dockview.DockviewComponent(appContainerRef.current, {
      theme: 'dockview-theme-dark',
      disableFloatingGroups: false,
      // Bố cục mặc định tối ưu cho game editor
      defaultLayout: {
        root: {
          type: 'split',
          direction: 'horizontal',
          data: [
            // Cột bên trái: Hierarchy + Assets
            {
              type: 'split',
              direction: 'vertical',
              data: [
                { type: 'panel', id: 'hierarchy', size: 25 },
                { type: 'panel', id: 'assets', size: 75 }
              ],
              size: 20
            },
            // Cột giữa: Game View + Console
            {
              type: 'split',
              direction: 'vertical',
              data: [
                { type: 'panel', id: 'game-canvas', size: 85 },
                { type: 'panel', id: 'console', size: 15 }
              ],
              size: 60
            },
            // Cột bên phải: Inspector
            {
              type: 'panel',
              id: 'inspector',
              size: 20
            }
          ]
        }
      }
    });

    // 📝 Đăng ký tất cả các panel
    dockview.registerPanelComponent('game', () => {
      const container = document.createElement('div');
      createRoot(container).render(<GamePanel />);
      return container;
    });

    dockview.registerPanelComponent('assets', () => {
      const container = document.createElement('div');
      createRoot(container).render(<AssetsPanel />);
      return container;
    });

    dockview.registerPanelComponent('inspector', () => {
      const container = document.createElement('div');
      createRoot(container).render(<InspectorPanel />);
      return container;
    });

    dockview.registerPanelComponent('hierarchy', () => {
      const container = document.createElement('div');
      createRoot(container).render(<HierarchyPanel />);
      return container;
    });

    dockview.registerPanelComponent('console', () => {
      const container = document.createElement('div');
      createRoot(container).render(<ConsolePanel />);
      return container;
    });

    console.log('🎮 Game editor initialized with professional layout!');
  }

  // 🎮 Xử lý các nút trên toolbar
  const handlePlay = () => {
    setIsPlaying(!isPlaying);
    if (window.gameEditor.pixiApp?.ticker) {
      isPlaying ? window.gameEditor.pixiApp.stop() : window.gameEditor.pixiApp.start();
    }
  };

  const handleSave = () => {
    window.gameEditor.emit('saveProject');
    console.log('💾 Project saved!');
  };

  return (
    <div className="w-screen h-screen flex flex-col bg-gray-950 overflow-hidden">
      {/* 🔝 Top Menu Bar */}
      <header className="h-9 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-1 text-sm">
        <span className="font-bold text-blue-400 mr-4">PixiJS Editor</span>
        <button className="px-3 py-1 hover:bg-gray-800 rounded text-gray-300">File</button>
        <button className="px-3 py-1 hover:bg-gray-800 rounded text-gray-300">Edit</button>
        <button className="px-3 py-1 hover:bg-gray-800 rounded text-gray-300">View</button>
        <button className="px-3 py-1 hover:bg-gray-800 rounded text-gray-300">GameObject</button>
        <button className="px-3 py-1 hover:bg-gray-800 rounded text-gray-300">Window</button>
        <button className="px-3 py-1 hover:bg-gray-800 rounded text-gray-300">Help</button>
      </header>

      {/* 🎛️ Toolbar chính */}
      <div className="h-12 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-2">
        {/* Play/Stop buttons */}
        <button
          onClick={handlePlay}
          className={`w-9 h-9 flex items-center justify-center rounded ${isPlaying ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'} text-white transition-colors`}
          title={isPlaying ? 'Stop (Ctrl+P)' : 'Play (Ctrl+P)'}
        >
          {isPlaying ? '⏹' : '▶'}
        </button>
        
        {/* Pause button */}
        <button
          onClick={() => window.gameEditor.pixiApp?.ticker?.stop()}
          className="w-9 h-9 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors"
          title="Pause (Ctrl+Shift+P)"
        >
          ⏸
        </button>

        <div className="w-px h-6 bg-gray-700 mx-2" />

        {/* Save button */}
        <button
          onClick={handleSave}
          className="w-9 h-9 flex items-center justify-center rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          title="Save Project (Ctrl+S)"
        >
          💾
        </button>

        <div className="w-px h-6 bg-gray-700 mx-2" />

        {/* Tools */}
        <button className="w-9 h-9 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors" title="Select (V)">
          ☝️
        </button>
        <button className="w-9 h-9 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors" title="Move">
          ✋
        </button>
        <button className="w-9 h-9 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors" title="Scale (R)">
          ⤡
        </button>
        <button className="w-9 h-9 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors" title="Rotate (E)">
          ↻
        </button>

        {/* Project name */}
        <div className="ml-auto flex items-center gap-2 text-gray-400 text-sm">
          <span>📁 {currentProjectName}</span>
        </div>
      </div>

      {/* 🖥️ Main Dockview Container - Chứa tất cả các panel */}
      <main 
        ref={appContainerRef} 
        className="flex-1 w-full relative"
        style={{ minHeight: 0 }}
      />

      {/* 📊 Bottom Status Bar */}
      <footer className="h-6 bg-blue-700 flex items-center px-4 text-xs text-white justify-between">
        <div className="flex items-center gap-4">
          <span>🎮 {isPlaying ? 'Playing' : 'Stopped'}</span>
          <span>⚡ {fps} FPS</span>
        </div>
        <div className="flex items-center gap-4">
          <span>🌐 PixiJS v{window.PIXI?.VERSION || '7.x'}</span>
          <span>🖥️ Tauri React App</span>
        </div>
      </footer>
    </div>
  );
}

export default App;