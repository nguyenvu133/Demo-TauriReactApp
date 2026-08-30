import { useEffect, useRef, useState } from 'react';
import { AssetManager } from '../../core/AssetManager';
import { SceneManager } from '../../core/SceneManager';
import { RectObject, CircleObject } from '../../core/GameObject';
import { PixiViewport2D, ViewportControls } from '../PixiViewport';

export function GamePanel() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const pixiAppRef = useRef<any>(null);
  const viewportRef = useRef<PixiViewport2D | null>(null);
  const [currentTool, setCurrentTool] = useState<string>('select');

  function addDemoSpriteToViewport(viewport: PixiViewport2D) {
    if (!window.PIXI) return;
    const graphics = new window.PIXI.Graphics();
    graphics.beginFill(0x3b82f6);
    graphics.drawRoundedRect(0, 0, 120, 80, 8);
    graphics.endFill();
    graphics.x = -60;
    graphics.y = -40;
    graphics.eventMode = 'static';
    graphics.cursor = 'pointer';

    viewport.addGameObject({
      id: 'demo_rect_001',
      x: 0, y: 0,
      scaleX: 1, scaleY: 1,
      rotation: 0,
      name: 'Demo Rectangle',
      type: 'rect',
      pixiSprite: graphics
    });
  }

  useEffect(() => {
    if (!canvasRef.current || pixiAppRef.current || !window.PIXI) return;

    const app = new window.PIXI.Application({
      width: 800,
      height: 600,
      backgroundColor: 0x0b0f19,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true
    });

    canvasRef.current.appendChild(app.view as HTMLCanvasElement);
    pixiAppRef.current = app;
    window.gameEditor.pixiApp = app;
    
    const viewport = new PixiViewport2D(app);
    viewportRef.current = viewport;
    window.gameEditor.viewport = viewport;
    
    const sceneManager = SceneManager.getInstance();
    sceneManager.init(app);
    window.gameEditor.sceneManager = sceneManager;
    
    addDemoSpriteToViewport(viewport);

    const element = canvasRef.current;
    element.addEventListener('dragover', handleDragOver);
    element.addEventListener('drop', handleDrop);

    const handleResize = () => {
      if (canvasRef.current && app.view instanceof HTMLCanvasElement) {
        const rect = canvasRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          app.renderer.resize(rect.width, rect.height);
        }
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      element.removeEventListener('dragover', handleDragOver);
      element.removeEventListener('drop', handleDrop);
      app.destroy(true);
    };
  }, []);

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }

  function handleObjectClick(object: any) {
    if (object) {
      pixiAppRef.current.selectedObject = object;
      (window as any).gameEditor?.emit('objectSelected', object);
    }
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault();
    if (!e.dataTransfer || !pixiAppRef.current) return;

    const assetId = e.dataTransfer.getData('assetId');
    const assetType = e.dataTransfer.getData('assetType');
    
    if (!assetId) return;

    const app = pixiAppRef.current;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    try {
      const assetManager = AssetManager.getInstance();
      if (assetType === 'image') {
        const sprite = await assetManager.createSpriteFromAsset(assetId);
        sprite.x = x;
        sprite.y = y;
        sprite.eventMode = 'static';
        sprite.cursor = 'pointer';
        sprite.on('pointerdown', () => handleObjectClick(sprite));

        app.stage.addChild(sprite);
        console.log(`[GamePanel] Added sprite at (${x}, ${y}):`, assetId);
      }
    } catch (error) {
      console.error('[GamePanel] Error loading asset:', error);
    }
  }
  
  const createRectangle = () => {
    const sceneManager = SceneManager.getInstance();
    const rect = new RectObject('Rectangle_' + Date.now(), 120, 80, 0x3b82f6);
    rect.position = { 
      x: 100 + Math.random() * 200, 
      y: 100 + Math.random() * 150 
    };
    
    rect.pixiObject.eventMode = 'static';
    rect.pixiObject.cursor = 'pointer';
    rect.pixiObject.on('pointerdown', () => {
      sceneManager.setSelectedObject(rect);
    });
    
    sceneManager.addObject(rect);
  };

  const createCircle = () => {
    const sceneManager = SceneManager.getInstance();
    const circle = new CircleObject('Circle_' + Date.now(), 40, 0xef4444);
    circle.position = { 
      x: 100 + Math.random() * 200, 
      y: 100 + Math.random() * 150 
    };
    
    circle.pixiObject.eventMode = 'static';
    circle.pixiObject.cursor = 'pointer';
    circle.pixiObject.on('pointerdown', () => {
      sceneManager.setSelectedObject(circle);
    });
    
    sceneManager.addObject(circle);
  };

  const createLine = () => {
    const sceneManager = SceneManager.getInstance();
    const lineRect = new RectObject('Line_' + Date.now(), 150, 4, 0x10b981);
    lineRect.position = { 
      x: 100 + Math.random() * 200, 
      y: 100 + Math.random() * 150 
    };
    
    lineRect.pixiObject.eventMode = 'static';
    lineRect.pixiObject.cursor = 'pointer';
    lineRect.pixiObject.on('pointerdown', () => {
      sceneManager.setSelectedObject(lineRect);
    });
    
    sceneManager.addObject(lineRect);
  };

  return (
    <div id="game-canvas-container" className="w-full h-full flex flex-col bg-gray-950 overflow-hidden relative">
      {/* Toolbar game view */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 border-b border-gray-800 shrink-0 z-10">
        <button 
          onClick={() => setCurrentTool('select')}
          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${currentTool === 'select' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
        >
          🖐️ Chọn
        </button>
        <div className="w-px h-5 bg-gray-700"></div>
        
        <button 
          onClick={createRectangle}
          className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded text-xs font-medium transition-colors"
          title="Thêm hình chữ nhật"
        >
          ▭ HCN
        </button>
        <button 
          onClick={createCircle}
          className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded text-xs font-medium transition-colors"
          title="Thêm hình tròn"
        >
          ● Tròn
        </button>
        <button 
          onClick={createLine}
          className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded text-xs font-medium transition-colors"
          title="Thêm đường thẳng"
        >
          ➖ Đường
        </button>
        <div className="w-px h-5 bg-gray-700"></div>
        <button 
          onClick={() => window.gameEditor?.pixiApp?.start()}
          className="px-2.5 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-xs font-medium transition-colors"
        >
          ▶ Chạy
        </button>
        <button 
          onClick={() => window.gameEditor?.pixiApp?.stop()}
          className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-medium transition-colors"
        >
          ⏹ Dừng
        </button>
        <div className="flex-1"></div>
        <span className="text-xs text-gray-400">800 × 600</span>
      </div>
      
      {/* Canvas container */}
      <div 
        ref={canvasRef} 
        className="flex-1 w-full h-full overflow-hidden relative"
      />
      
      {/* Viewport Zoom Controls */}
      <ViewportControls viewport={viewportRef.current} />
      
      {/* Hints */}
      <div className="absolute bottom-2 right-2 bg-gray-900/90 backdrop-blur border border-gray-800 px-2.5 py-1 rounded-lg text-[11px] text-gray-400 select-none z-10 pointer-events-none">
        <span>Scroll: Zoom | Alt+Drag: Pan | Click: Select</span>
      </div>
    </div>
  );
}

export default GamePanel;

