import { useEffect, useRef, useState } from 'react';


// Type definitions cho PixiJS Viewport
interface ViewportState {
  zoom: number;
  position: { x: number; y: number };
  minZoom: number;
  maxZoom: number;
  isPanning: boolean;
}

interface GameObject {
  id: string;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  name: string;
  type: string;
  pixiSprite: any;
}

// Viewport class Ä‘á»ƒ quáº£n lÃ½ camera 2D
export class PixiViewport2D {
  private app: any; // PixiApplication
  private container: any; // Container chÃ­nh chá»©a táº¥t cáº£ game objects
  private state: ViewportState = {
    zoom: 1,
    position: { x: 0, y: 0 },
    minZoom: 0.1,
    maxZoom: 5,
    isPanning: false
  };
  private lastMousePos = { x: 0, y: 0 };
  private gameObjects: Map<string, GameObject> = new Map();
  private selectedObjectId: string | null = null;
  private selectionOutline: any | null = null;

  constructor(pixiApp: any) {
    this.app = pixiApp;
    this.container = new window.PIXI.Container();
    this.app.stage.addChild(this.container);
    
    // LÆ°u á»©ng dá»¥ng vÃ o window Ä‘á»ƒ truy cáº­p tá»« cÃ¡c panel khÃ¡c - fix: dÃ¹ng pixiApp (tham sá»‘) thay vÃ¬ app
    window.gameEditor.pixiApp = pixiApp;
    
    this.setupViewportEvents();
    this.setupZoomControls();
    this.addGridBackground();
    console.log('âœ… PixiViewport2D initialized with pan/zoom/grid support');
  }

  // ThÃªm grid background giá»‘ng editor chuyÃªn nghiá»‡p
  private addGridBackground() {
    const gridContainer = new window.PIXI.Container();
    const gridSize = 32; // KÃ­ch thÆ°á»›c Ã´ lÆ°á»›i
    const canvasWidth = this.app.screen.width * 2;
    const canvasHeight = this.app.screen.height * 2;
    
    // Táº¡o texture lÆ°á»›i
    const gridCanvas = document.createElement('canvas');
    gridCanvas.width = gridSize * 2;
    gridCanvas.height = gridSize * 2;
    const ctx = gridCanvas.getContext('2d')!;
    
    // MÃ u ná»n chÃ­nh
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, gridCanvas.width, gridCanvas.height);
    
    // MÃ u lÆ°á»›i
    ctx.strokeStyle = '#2d2d44';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, gridSize, gridSize);
    ctx.strokeRect(gridSize, gridSize, gridSize, gridSize);
    
    const gridTexture = window.PIXI.Texture.from(gridCanvas);
    gridTexture.wrapMode = window.PIXI.WRAP_MODES.REPEAT;
    
    const gridSprite = new window.PIXI.Sprite(gridTexture);
    gridSprite.width = canvasWidth;
    gridSprite.height = canvasHeight;
    gridSprite.position.set(-canvasWidth/2, -canvasHeight/2);
    
    gridContainer.addChild(gridSprite);
    this.container.addChildAt(gridSprite, 0);
  }

  // Thiáº¿t láº­p cÃ¡c sá»± kiá»‡n kÃ©o tháº£, zoom
  private setupViewportEvents() {
    const viewportElement = this.app.view;
    
    // Mouse wheel Ä‘á»ƒ zoom
    viewportElement.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      this.zoomAtPoint(e.offsetX, e.offsetY, zoomFactor);
    });

    // Báº¯t Ä‘áº§u kÃ©o (pan)
    viewportElement.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && e.altKey)) { // Chuá»™t giá»¯a hoáº·c Alt + chuá»™t trÃ¡i
        this.state.isPanning = true;
        this.lastMousePos = { x: e.clientX, y: e.clientY };
        viewportElement.style.cursor = 'grabbing';
      }
    });

    // KÃ©o trong quÃ¡ trÃ¬nh di chuyá»ƒn chuá»™t
    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (this.state.isPanning) {
        const dx = e.clientX - this.lastMousePos.x;
        const dy = e.clientY - this.lastMousePos.y;
        this.pan(dx, dy);
        this.lastMousePos = { x: e.clientX, y: e.clientY };
      }
    });

    // Káº¿t thÃºc kÃ©o
    window.addEventListener('mouseup', () => {
      if (this.state.isPanning) {
        this.state.isPanning = false;
        viewportElement.style.cursor = 'default';
      }
    });

    // Click chá»n Ä‘á»‘i tÆ°á»£ng
    viewportElement.addEventListener('click', (e: MouseEvent) => {
      if (!this.state.isPanning) {
        this.selectObjectAtScreenPos(e.offsetX, e.offsetY);
      }
    });
  }

  // Zoom táº¡i vá»‹ trÃ­ con trá» - public Ä‘á»ƒ gá»i tá»« UI controls
  zoomAtPoint(screenX: number, screenY: number, factor: number) {
    const worldPos = this.screenToWorld(screenX, screenY);
    
    const newZoom = Math.max(this.state.minZoom, Math.min(this.state.maxZoom, this.state.zoom * factor));
    const zoomChange = newZoom / this.state.zoom;
    
    this.state.position.x += (worldPos.x - this.state.position.x) * (1 - zoomChange);
    this.state.position.y += (worldPos.y - this.state.position.y) * (1 - zoomChange);
    this.state.zoom = newZoom;
    
    this.updateContainerTransform();
    this.emitViewportChanged();
  }

  // KÃ©o viewport
  private pan(dx: number, dy: number) {
    this.state.position.x += dx;
    this.state.position.y += dy;
    this.updateContainerTransform();
    this.emitViewportChanged();
  }

  // Cáº­p nháº­t vá»‹ trÃ­ vÃ  scale cá»§a container
  private updateContainerTransform() {
    this.container.x = this.state.position.x;
    this.container.y = this.state.position.y;
    this.container.scale.set(this.state.zoom);
  }

  // Chuyá»ƒn tá»a Ä‘á»™ mÃ n hÃ¬nh sang tá»a Ä‘á»™ world
  screenToWorld(screenX: number, screenY: number) {
    return {
      x: (screenX - this.state.position.x) / this.state.zoom,
      y: (screenY - this.state.position.y) / this.state.zoom
    };
  }

  // Chuyá»ƒn tá»a Ä‘á»™ world sang mÃ n hÃ¬nh
  worldToScreen(worldX: number, worldY: number) {
    return {
      x: worldX * this.state.zoom + this.state.position.x,
      y: worldY * this.state.zoom + this.state.position.y
    };
  }

  // Chá»n Ä‘á»‘i tÆ°á»£ng táº¡i vá»‹ trÃ­ click
  private selectObjectAtScreenPos(screenX: number, screenY: number) {
    const worldPos = this.screenToWorld(screenX, screenY);
    
    // TÃ¬m Ä‘á»‘i tÆ°á»£ng dÆ°á»›i con trá»
    for (const [id, obj] of this.gameObjects) {
      if (obj.pixiSprite && obj.pixiSprite.getBounds().contains(worldPos.x, worldPos.y)) {
        this.selectObject(id);
        return;
      }
    }
    
    // Náº¿u khÃ´ng cÃ³ Ä‘á»‘i tÆ°á»£ng nÃ o, bá» chá»n
    this.deselectObject();
  }

  // Chá»n Ä‘á»‘i tÆ°á»£ng vÃ  hiá»ƒn thá»‹ outline
  private selectObject(id: string) {
    const obj = this.gameObjects.get(id);
    if (!obj) return;
    
    this.deselectObject();
    this.selectedObjectId = id;
    
    // Táº¡o outline xanh dÆ°Æ¡ng quanh Ä‘á»‘i tÆ°á»£ng Ä‘Æ°á»£c chá»n
    if (obj.pixiSprite) {
      const bounds = obj.pixiSprite.getBounds();
      this.selectionOutline = new window.PIXI.Graphics();
      this.selectionOutline.lineStyle(2, 0x3b82f6, 1);
      this.selectionOutline.drawRect(bounds.x - 5, bounds.y - 5, bounds.width + 10, bounds.height + 10);
      this.container.addChild(this.selectionOutline);
    }
    
    // PhÃ¡t sá»± kiá»‡n cho InspectorPanel
    window.dispatchEvent(new CustomEvent('objectSelected', { detail: obj }));
  }

  // Bá» chá»n Ä‘á»‘i tÆ°á»£ng
  private deselectObject() {
    if (this.selectionOutline) {
      this.container.removeChild(this.selectionOutline);
      this.selectionOutline = null;
    }
    this.selectedObjectId = null;
  }

  // ThÃªm Ä‘á»‘i tÆ°á»£ng game vÃ o viewport
  addGameObject(obj: GameObject) {
    if (obj.pixiSprite) {
      this.container.addChild(obj.pixiSprite);
      this.gameObjects.set(obj.id, obj);
    }
  }

  // XÃ³a Ä‘á»‘i tÆ°á»£ng khá»i viewport
  removeGameObject(id: string) {
    const obj = this.gameObjects.get(id);
    if (obj && obj.pixiSprite) {
      this.container.removeChild(obj.pixiSprite);
      this.gameObjects.delete(id);
    }
    if (this.selectedObjectId === id) {
      this.deselectObject();
    }
  }

  // Thiáº¿t láº­p cÃ¡c nÃºt Ä‘iá»u khiá»ƒn zoom
  private setupZoomControls() {
    // Báº¡n cÃ³ thá»ƒ thÃªm UI control: nÃºt +, -, reset zoom
  }

  // PhÃ¡t sá»± kiá»‡n khi viewport thay Ä‘á»•i
  private emitViewportChanged() {
    window.dispatchEvent(new CustomEvent('viewportChanged', { 
      detail: { 
        zoom: this.state.zoom,
        position: this.state.position
      } 
    }));
  }

  // Reset viewport vá» vá»‹ trÃ­ ban Ä‘áº§u - public Ä‘á»ƒ gá»i tá»« UI controls
  reset() {
    this.state.zoom = 1;
    this.state.position = { x: this.app.screen.width / 2, y: this.app.screen.height / 2 };
    this.updateContainerTransform();
  }

  // Láº¥y tráº¡ng thÃ¡i hiá»‡n táº¡i
  getState() { return { ...this.state }; }
  getContainer() { return this.container; }
}

// React component Ä‘á»ƒ tÃ­ch há»£p vÃ o GamePanel
export function PixiViewportComponent({ pixiApp }: { pixiApp: any }) {
  const viewportRef = useRef<PixiViewport2D | null>(null);

  useEffect(() => {
    if (pixiApp && !viewportRef.current) {
      viewportRef.current = new PixiViewport2D(pixiApp);
      
      // ThÃªm cÃ¡c Ä‘á»‘i tÆ°á»£ng demo vÃ o viewport
      const demoSprite = new window.PIXI.Sprite(window.PIXI.Texture.from('https://picsum.photos/128/128'));
      demoSprite.position.set(-64, -64);
      
      viewportRef.current.addGameObject({
        id: 'player_001',
        x: 0, y: 0,
        scaleX: 1, scaleY: 1,
        rotation: 0,
        name: 'Player',
        type: 'sprite',
        pixiSprite: demoSprite
      });
    }

    return () => {
      // Cleanup
    };
  }, [pixiApp]);

  return null; // Component áº©n, chá»‰ cháº¡y logic PixiJS
}

// Component UI Ä‘iá»u khiá»ƒn viewport
export function ViewportControls({ viewport }: { viewport: PixiViewport2D | null }) {
  const [zoom, setZoom] = useState(100);

  const handleZoomIn = () => {
    if (viewport) viewport.zoomAtPoint(window.innerWidth/2, window.innerHeight/2, 1.2);
    setZoom(Math.round(viewport!.getState().zoom * 100));
  };

  const handleZoomOut = () => {
    if (viewport) viewport.zoomAtPoint(window.innerWidth/2, window.innerHeight/2, 0.8);
    setZoom(Math.round(viewport!.getState().zoom * 100));
  };

  const handleReset = () => {
    if (viewport) viewport.reset();
    setZoom(100);
  };

  return (
    <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-gray-900/90 backdrop-blur border border-gray-800 p-1.5 rounded-lg shadow-lg z-10 text-xs">
      <button 
        onClick={handleZoomOut} 
        className="w-6 h-6 flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded text-white font-bold"
        title="Zoom out"
      >-</button>
      <span className="text-white text-xs w-10 text-center font-mono">{zoom}%</span>
      <button 
        onClick={handleZoomIn} 
        className="w-6 h-6 flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded text-white font-bold"
        title="Zoom in"
      >+</button>
      <button 
        onClick={handleReset} 
        className="px-2 h-6 bg-blue-600 hover:bg-blue-500 rounded text-white text-[11px]"
        title="Reset view"
      >Reset</button>
    </div>
  );
}


