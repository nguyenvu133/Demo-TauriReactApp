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

  // 🎯 Hàm thêm demo sprite vào viewport - định nghĩa TRƯỚC useEffect để fix hoisting (lỗi "addDemoSpriteToViewport is not defined")
  function addDemoSpriteToViewport(viewport: PixiViewport2D) {
    const graphics = new window.PIXI.Graphics();
    graphics.beginFill(0x4a9eff);
    graphics.drawRoundedRect(0, 0, 120, 80, 8);
    graphics.endFill();
    graphics.x = -60; // Căn giữa tại (0,0)
    graphics.y = -40;
    graphics.interactive = true;
    graphics.buttonMode = true;

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
    if (!canvasRef.current || pixiAppRef.current) return;

    // Khởi tạo PixiJS App
    const app = new window.PIXI.Application({
      width: 800,
      height: 600,
      backgroundColor: 0x1a1a2e,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true
    });

    canvasRef.current.appendChild(app.view as HTMLCanvasElement);
    pixiAppRef.current = app;

    // Lưu ứng dụng vào window để truy cập từ các panel khác
    window.gameEditor.pixiApp = app;
    
    // 🌟 KHỞI TẠO VIEWPORT 2D chuyên nghiệp (thay thế grid cũ)
    const viewport = new PixiViewport2D(app);
    viewportRef.current = viewport;
    window.gameEditor.viewport = viewport;
    
    // Khởi tạo SceneManager
    const sceneManager = SceneManager.getInstance();
    sceneManager.init(app);
    window.gameEditor.sceneManager = sceneManager;
    
    // Thêm demo rectangle vào viewport (thay thế addDemoSprite cũ)
    addDemoSpriteToViewport(viewport);

    // Lắng nghe sự kiện drop từ AssetsPanel
    const element = canvasRef.current;
    element.addEventListener('dragover', handleDragOver);
    element.addEventListener('drop', handleDrop);

    // Handle window resize
    const handleResize = () => {
      if (canvasRef.current && app.view instanceof HTMLCanvasElement) {
        const rect = canvasRef.current.getBoundingClientRect();
        app.renderer.resize(rect.width, rect.height);
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

  // Thêm grid background cho editor
  function addGridBackground(app: any) {
    const gridSize = 50;
    const graphics = new window.PIXI.Graphics();
    graphics.lineStyle(1, 0x333344, 0.5);
    
    // Vẽ lưới ngang
    for (let y = 0; y < app.screen.height; y += gridSize) {
      graphics.moveTo(0, y);
      graphics.lineTo(app.screen.width, y);
    }
    
    // Vẽ lưới dọc
    for (let x = 0; x < app.screen.width; x += gridSize) {
      graphics.moveTo(x, 0);
      graphics.lineTo(x, app.screen.height);
    }
    
    graphics.zIndex = -1;
    app.stage.addChild(graphics);
  }

  // Sprite demo ban đầu
  function addDemoSprite(app: any) {
    const graphics = new window.PIXI.Graphics();
    graphics.beginFill(0x4a9eff);
    graphics.drawRoundedRect(100, 100, 120, 80, 8);
    graphics.endFill();
    graphics.interactive = true;
    graphics.buttonMode = true;
    
    // Thêm sự kiện click để chọn trong inspector
    graphics.on('click', () => handleObjectClick(graphics));

    app.stage.addChild(graphics);

    // Animation
    app.ticker.add(() => {
      graphics.rotation += 0.01;
    });
  }

  // Xử lý kéo thả
  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'copy';
  }

  // Xử lý chọn đối tượng khi click
  function handleObjectClick(object: any) {
    // Bỏ chọn đối tượng cũ (xóa outline nếu có)
    if (pixiAppRef.current?.selectedObject) {
      // Logic xóa outline cũ
    }
    
    // Thêm outline cho đối tượng mới để hiển thị đang được chọn
    if (object) {
      pixiAppRef.current.selectedObject = object;
      // Phát sự kiện chọn đối tượng cho InspectorPanel
      (window as any).gameEditor?.emit('objectSelected', object);
    }
  }

  // Xử lý khi drop asset vào game view
  async function handleDrop(e: DragEvent) {
    e.preventDefault();
    const assetId = e.dataTransfer!.getData('assetId');
    const assetType = e.dataTransfer!.getData('assetType');
    
    if (!assetId || !pixiAppRef.current) return;

    const app = pixiAppRef.current;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    try {
      const assetManager = AssetManager.getInstance();
      
      // Nếu là image thì tạo sprite
      if (assetType === 'image') {
        const sprite = await assetManager.createSpriteFromAsset(assetId);
        sprite.x = x;
        sprite.y = y;
        sprite.interactive = true;
        sprite.buttonMode = true;
        
        // Thêm sự kiện click để chọn đối tượng
        sprite.on('click', () => handleObjectClick(sprite));

        app.stage.addChild(sprite);
        console.log(`[GamePanel] Added sprite at (${x}, ${y}):`, assetId);
      }
      // Các loại khác có thể xử lý tương tự (spine, model 3D...)
      else if (assetType === 'spine') {
        // Spine animation sẽ được thêm ở đây
        console.log('[GamePanel] Spine asset dropped:', assetId);
      } 
      else if (assetType === 'gltf') {
        // GLTF model sẽ được thêm ở đây
        console.log('[GamePanel] 3D model dropped:', assetId);
      }
    } catch (error) {
      console.error('[GamePanel] Error loading asset:', error);
    }
  }
  
  // Tạo hình chữ nhật mới bằng GameObject
  const createRectangle = () => {
    const sceneManager = SceneManager.getInstance();
    const rect = new RectObject('Rectangle_' + Date.now(), 120, 80, 0x4a9eff);
    rect.position = { 
      x: 100 + Math.random() * 300, 
      y: 100 + Math.random() * 200 
    };
    
    // Bật tương tác để click chọn
    rect.pixiObject.interactive = true;
    rect.pixiObject.buttonMode = true;
    rect.pixiObject.on('click', () => {
      sceneManager.setSelectedObject(rect);
    });
    
    sceneManager.addObject(rect);
  };

  // Tạo hình tròn mới bằng GameObject
  const createCircle = () => {
    const sceneManager = SceneManager.getInstance();
    const circle = new CircleObject('Circle_' + Date.now(), 50, 0xff6b6b);
    circle.position = { 
      x: 100 + Math.random() * 300, 
      y: 100 + Math.random() * 200 
    };
    
    // Bật tương tác để click chọn
    circle.pixiObject.interactive = true;
    circle.pixiObject.buttonMode = true;
    circle.pixiObject.on('click', () => {
      sceneManager.setSelectedObject(circle);
    });
    
    sceneManager.addObject(circle);
  };

  // Tạo đường thẳng mới bằng RectObject (đơn giản hóa)
  const createLine = () => {
    const sceneManager = SceneManager.getInstance();
    const lineRect = new RectObject('Line_' + Date.now(), 150, 3, 0x4ade80);
    lineRect.position = { 
      x: 100 + Math.random() * 300, 
      y: 100 + Math.random() * 200 
    };
    
    // Bật tương tác để click chọn
    lineRect.pixiObject.interactive = true;
    lineRect.pixiObject.buttonMode = true;
    lineRect.pixiObject.on('click', () => {
      sceneManager.setSelectedObject(lineRect);
    });
    
    sceneManager.addObject(lineRect);
  };

  return (
    <div id="game-canvas-container" className="w-full h-full flex flex-col bg-gray-950 overflow-hidden">
      {/* Toolbar game view với công cụ tạo đối tượng 2D */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 border-b border-gray-800 flex-wrap">
        <button 
          onClick={() => setCurrentTool('select')}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${currentTool === 'select' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
        >
          🖐️ Chọn
        </button>
        <div className="w-px h-6 bg-gray-600"></div>
        {/* Công cụ vẽ 2D cơ bản */}
        <button 
          onClick={createRectangle}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs font-medium transition-colors"
          title="Thêm hình chữ nhật"
        >
          ▭ HCN
        </button>
        <button 
          onClick={createCircle}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs font-medium transition-colors"
          title="Thêm hình tròn"
        >
          ● Tròn
        </button>
        <button 
          onClick={createLine}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs font-medium transition-colors"
          title="Thêm đường thẳng"
        >
          ➖ Đường
        </button>
        <div className="w-px h-6 bg-gray-600"></div>
        <button className="px-3 py-1 bg-green-600 hover:bg-green-500 rounded text-xs font-medium transition-colors">
          ▶ Chạy
        </button>
        <button className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-xs font-medium transition-colors">
          ⏹ Dừng
        </button>
        <div className="flex-1"></div>
        <span className="text-xs text-gray-500">800 × 600</span>
        <select className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-300">
          <option>100%</option>
          <option>75%</option>
          <option>50%</option>
          <option>25%</option>
        </select>
      </div>
      
      {/* Canvas container */}
      <div 
        ref={canvasRef} 
        className="flex-1 overflow-hidden relative"
        style={{ minHeight: '400px' }}
      >
        {/* PixiJS canvas sẽ được thêm vào đây */}
      </div>
      
      {/* 🔍 Control panel zoom của Viewport */}
      <ViewportControls viewport={viewportRef.current} />
      
      {/* 📝 Hướng dẫn sử dụng */}
      <div className="absolute bottom-4 right-4 bg-gray-800/80 backdrop-blur px-3 py-2 rounded text-xs text-gray-400">
        <p>Scroll: Zoom | Alt+Drag: Pan | Click: Select</p>
      </div>
    </div>
  );}

export default GamePanel;