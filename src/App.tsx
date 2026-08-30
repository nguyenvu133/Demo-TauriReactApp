import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./App.css";
import { GamePanel } from "./components/panels/GamePanel.tsx";
import { AssetsPanel } from "./components/panels/AssetsPanel.tsx";
import { InspectorPanel } from "./components/panels/InspectorPanel.tsx";
import { HierarchyPanel } from "./components/panels/HierarchyPanel.tsx";
import { ConsolePanel } from "./components/panels/ConsolePanel.tsx";

// Khai bÃ¡o cÃ¡c thÆ° viá»‡n toÃ n cá»¥c Ä‘Æ°á»£c load tá»« CDN
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

    // Khá»Ÿi táº¡o event emitter cho gameEditor
    const eventTarget = new EventTarget();
    window.gameEditor.emit = (event: string, data?: any) => {
      eventTarget.dispatchEvent(new CustomEvent(event, { detail: data }));
    };
    window.gameEditor.on = (event: string, callback: (data: any) => void) => {
      eventTarget.addEventListener(event, (e: any) => callback(e.detail));
    };

    // Äá»£i táº¥t cáº£ script CDN load xong trÆ°á»›c khi khá»Ÿi táº¡o editor
    const waitForScriptsAndInit = () => {
      if (typeof window.dockview !== 'undefined' && typeof window.PIXI !== 'undefined') {
        console.log('âœ… All CDN scripts loaded, initializing editor...');
        initGameEditor();
        setIsEditorInitialized(true);
      } else {
        console.log('â³ Waiting for CDN scripts to load...');
        setTimeout(waitForScriptsAndInit, 500);
      }
    };

    // Theo dÃµi FPS
    waitForScriptsAndInit();

    const fpsCounter = setInterval(() => {
      if (window.gameEditor.pixiApp?.ticker) {
        setFps(Math.round(window.gameEditor.pixiApp.ticker.FPS));
      }
    }, 1000);

    return () => clearInterval(fpsCounter);
  }, [isEditorInitialized]);

  function initGameEditor() {
    if (!appContainerRef.current) return;

    // ðŸŽ¨ Cáº¥u hÃ¬nh Dockview layout chuyÃªn nghiá»‡p
    const dockview = new window.dockview.DockviewComponent(appContainerRef.current, {
      theme: 'dockview-theme-dark',
      disableFloatingGroups: false,
      // Bá»‘ cá»¥c máº·c Ä‘á»‹nh tá»‘i Æ°u cho game editor
      defaultLayout: {
        root: {
          type: 'split',
          direction: 'horizontal',
          data: [
            // Cá»™t bÃªn trÃ¡i: Hierarchy + Assets
            {
              type: 'split',
              direction: 'vertical',
              data: [
                { type: 'panel', id: 'hierarchy', size: 25 },
                { type: 'panel', id: 'assets', size: 75 }
              ],
              size: 20
            },
            // Cá»™t giá»¯a: Game View + Console
            {
              type: 'split',
              direction: 'vertical',
              data: [
                { type: 'panel', id: 'game-canvas', size: 85 },
                { type: 'panel', id: 'console', size: 15 }
              ],
              size: 60
            },
            // Cá»™t bÃªn pháº£i: Inspector
            {
              type: 'panel',
              id: 'inspector',
              size: 20
            }
          ]
        }
      }
    });

    // ðŸ“ ÄÄƒng kÃ½ táº¥t cáº£ cÃ¡c panel
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

    console.log('ðŸŽ® Game editor initialized with professional layout!');
  }

  // ðŸŽ® Xá»­ lÃ½ cÃ¡c nÃºt trÃªn toolbar
  const handlePlay = () => {
    setIsPlaying(!isPlaying);
    if (window.gameEditor.pixiApp?.ticker) {
      isPlaying ? window.gameEditor.pixiApp.stop() : window.gameEditor.pixiApp.start();
    }
  };

  const handleSave = () => {
    window.gameEditor.emit('saveProject');
    console.log('ðŸ’¾ Project saved!');
  };

  return (
    <div className="w-screen h-screen flex flex-col bg-gray-950 overflow-hidden">
      {/* ðŸ” Top Menu Bar */}
      <header className="h-9 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-1 text-sm">
        <span className="font-bold text-blue-400 mr-4">PixiJS Editor</span>
        <button className="px-3 py-1 hover:bg-gray-800 rounded text-gray-300">File</button>
        <button className="px-3 py-1 hover:bg-gray-800 rounded text-gray-300">Edit</button>
        <button className="px-3 py-1 hover:bg-gray-800 rounded text-gray-300">View</button>
        <button className="px-3 py-1 hover:bg-gray-800 rounded text-gray-300">GameObject</button>
        <button className="px-3 py-1 hover:bg-gray-800 rounded text-gray-300">Window</button>
        <button className="px-3 py-1 hover:bg-gray-800 rounded text-gray-300">Help</button>
      </header>

      {/* ðŸŽ›ï¸ Toolbar chÃ­nh */}
      <div className="h-12 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-2">
        {/* Play/Stop buttons */}
        <button
          onClick={handlePlay}
          className={`w-9 h-9 flex items-center justify-center rounded ${isPlaying ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'} text-white transition-colors`}
          title={isPlaying ? 'Stop (Ctrl+P)' : 'Play (Ctrl+P)'}
        >
          {isPlaying ? 'â¹' : 'â–¶'}
        </button>
        
        {/* Pause button */}
        <button
          onClick={() => window.gameEditor.pixiApp?.ticker?.stop()}
          className="w-9 h-9 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors"
          title="Pause (Ctrl+Shift+P)"
        >
          â¸
        </button>

        <div className="w-px h-6 bg-gray-700 mx-2" />

        {/* Save button */}
        <button
          onClick={handleSave}
          className="w-9 h-9 flex items-center justify-center rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          title="Save Project (Ctrl+S)"
        >
          ðŸ’¾
        </button>

        <div className="w-px h-6 bg-gray-700 mx-2" />

        {/* Tools */}
        <button className="w-9 h-9 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors" title="Select (V)">
          â˜ï¸
        </button>
        <button className="w-9 h-9 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors" title="Move">
          âœ‹
        </button>
        <button className="w-9 h-9 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors" title="Scale (R)">
          â¤¡
        </button>
        <button className="w-9 h-9 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors" title="Rotate (E)">
          â†»
        </button>

        {/* Project name */}
        <div className="ml-auto flex items-center gap-2 text-gray-400 text-sm">
          <span>ðŸ“ {currentProjectName}</span>
        </div>
      </div>

      {/* ðŸ–¥ï¸ Main Dockview Container - Chá»©a táº¥t cáº£ cÃ¡c panel */}
      <main 
        ref={appContainerRef} 
        className="flex-1 w-full relative"
        style={{ minHeight: 0 }}
      />

      {/* ðŸ“Š Bottom Status Bar */}
      <footer className="h-6 bg-blue-700 flex items-center px-4 text-xs text-white justify-between">
        <div className="flex items-center gap-4">
          <span>ðŸŽ® {isPlaying ? 'Playing' : 'Stopped'}</span>
          <span>âš¡ {fps} FPS</span>
        </div>
        <div className="flex items-center gap-4">
          <span>ðŸŒ PixiJS v{window.PIXI?.VERSION || '7.x'}</span>
          <span>ðŸ–¥ï¸ Tauri React App</span>
        </div>
      </footer>
    </div>
  );
}

export default App;