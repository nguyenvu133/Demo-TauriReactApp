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

// Viewport class để quản lý camera 2D
export class PixiViewport2D {
  private app: any; // PixiApplication
  private container: any; // Container chính chứa tất cả game objects
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
    
    // Lưu ứng dụng vào window để truy cập từ các panel khác - fix: dùng pixiApp (tham số) thay vì app
    window.gameEditor.pixiApp = pixiApp;
    
    this.setupViewportEvents();
    this.setupZoomControls();
    this.addGridBackground();
    console.log('✅ PixiViewport2D initialized with pan/zoom/grid support');
  }

  // Thêm grid background giống editor chuyên nghiệp
  private addGridBackground() {
    const gridContainer = new window.PIXI.Container();
    const gridSize = 32; // Kích thước ô lưới
    const canvasWidth = this.app.screen.width * 2;
    const canvasHeight = this.app.screen.height * 2;
    
    // Tạo texture lưới
    const gridCanvas = document.createElement('canvas');
    gridCanvas.width = gridSize * 2;
    gridCanvas.height = gridSize * 2;
    const ctx = gridCanvas.getContext('2d')!;
    
    // Màu nền chính
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, gridCanvas.width, gridCanvas.height);
    
    // Màu lưới
    ctx.strokeStyle = '#2d2d44';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, gridSize, gridSize);
    ctx.strokeRect(gridSize, gridSize, gridSize, gridSize);
    
    const gridTexture = window.PIXI.Texture.fromCanvas(gridCanvas);
    gridTexture.wrapMode = window.PIXI.WRAP_MODES.REPEAT;
    
    const gridSprite = new window.PIXI.Sprite(gridTexture);
    gridSprite.width = canvasWidth;
    gridSprite.height = canvasHeight;
    gridSprite.position.set(-canvasWidth/2, -canvasHeight/2);
    
    gridContainer.addChild(gridSprite);
    this.container.addChildAt(gridSprite, 0);
  }

  // Thiết lập các sự kiện kéo thả, zoom
  private setupViewportEvents() {
    const viewportElement = this.app.view;
    
    // Mouse wheel để zoom
    viewportElement.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      this.zoomAtPoint(e.offsetX, e.offsetY, zoomFactor);
    });

    // Bắt đầu kéo (pan)
    viewportElement.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && e.altKey)) { // Chuột giữa hoặc Alt + chuột trái
        this.state.isPanning = true;
        this.lastMousePos = { x: e.clientX, y: e.clientY };
        viewportElement.style.cursor = 'grabbing';
      }
    });

    // Kéo trong quá trình di chuyển chuột
    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (this.state.isPanning) {
        const dx = e.clientX - this.lastMousePos.x;
        const dy = e.clientY - this.lastMousePos.y;
        this.pan(dx, dy);
        this.lastMousePos = { x: e.clientX, y: e.clientY };
      }
    });

    // Kết thúc kéo
    window.addEventListener('mouseup', () => {
      if (this.state.isPanning) {
        this.state.isPanning = false;
        viewportElement.style.cursor = 'default';
      }
    });

    // Click chọn đối tượng
    viewportElement.addEventListener('click', (e: MouseEvent) => {
      if (!this.state.isPanning) {
        this.selectObjectAtScreenPos(e.offsetX, e.offsetY);
      }
    });
  }

  // Zoom tại vị trí con trỏ - public để gọi từ UI controls
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

  // Kéo viewport
  private pan(dx: number, dy: number) {
    this.state.position.x += dx;
    this.state.position.y += dy;
    this.updateContainerTransform();
    this.emitViewportChanged();
  }

  // Cập nhật vị trí và scale của container
  private updateContainerTransform() {
    this.container.x = this.state.position.x;
    this.container.y = this.state.position.y;
    this.container.scale.set(this.state.zoom);
  }

  // Chuyển tọa độ màn hình sang tọa độ world
  screenToWorld(screenX: number, screenY: number) {
    return {
      x: (screenX - this.state.position.x) / this.state.zoom,
      y: (screenY - this.state.position.y) / this.state.zoom
    };
  }

  // Chuyển tọa độ world sang màn hình
  worldToScreen(worldX: number, worldY: number) {
    return {
      x: worldX * this.state.zoom + this.state.position.x,
      y: worldY * this.state.zoom + this.state.position.y
    };
  }

  // Chọn đối tượng tại vị trí click
  private selectObjectAtScreenPos(screenX: number, screenY: number) {
    const worldPos = this.screenToWorld(screenX, screenY);
    
    // Tìm đối tượng dưới con trỏ
    for (const [id, obj] of this.gameObjects) {
      if (obj.pixiSprite && obj.pixiSprite.getBounds().contains(worldPos.x, worldPos.y)) {
        this.selectObject(id);
        return;
      }
    }
    
    // Nếu không có đối tượng nào, bỏ chọn
    this.deselectObject();
  }

  // Chọn đối tượng và hiển thị outline
  private selectObject(id: string) {
    const obj = this.gameObjects.get(id);
    if (!obj) return;
    
    this.deselectObject();
    this.selectedObjectId = id;
    
    // Tạo outline xanh dương quanh đối tượng được chọn
    if (obj.pixiSprite) {
      const bounds = obj.pixiSprite.getBounds();
      this.selectionOutline = new window.PIXI.Graphics();
      this.selectionOutline.lineStyle(2, 0x3b82f6, 1);
      this.selectionOutline.drawRect(bounds.x - 5, bounds.y - 5, bounds.width + 10, bounds.height + 10);
      this.container.addChild(this.selectionOutline);
    }
    
    // Phát sự kiện cho InspectorPanel
    window.dispatchEvent(new CustomEvent('objectSelected', { detail: obj }));
  }

  // Bỏ chọn đối tượng
  private deselectObject() {
    if (this.selectionOutline) {
      this.container.removeChild(this.selectionOutline);
      this.selectionOutline = null;
    }
    this.selectedObjectId = null;
  }

  // Thêm đối tượng game vào viewport
  addGameObject(obj: GameObject) {
    if (obj.pixiSprite) {
      this.container.addChild(obj.pixiSprite);
      this.gameObjects.set(obj.id, obj);
    }
  }

  // Xóa đối tượng khỏi viewport
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

  // Thiết lập các nút điều khiển zoom
  private setupZoomControls() {
    // Bạn có thể thêm UI control: nút +, -, reset zoom
  }

  // Phát sự kiện khi viewport thay đổi
  private emitViewportChanged() {
    window.dispatchEvent(new CustomEvent('viewportChanged', { 
      detail: { 
        zoom: this.state.zoom,
        position: this.state.position
      } 
    }));
  }

  // Reset viewport về vị trí ban đầu - public để gọi từ UI controls
  reset() {
    this.state.zoom = 1;
    this.state.position = { x: this.app.screen.width / 2, y: this.app.screen.height / 2 };
    this.updateContainerTransform();
  }

  // Lấy trạng thái hiện tại
  getState() { return { ...this.state }; }
  getContainer() { return this.container; }
}

// React component để tích hợp vào GamePanel
export function PixiViewportComponent({ pixiApp }: { pixiApp: any }) {
  const viewportRef = useRef<PixiViewport2D | null>(null);

  useEffect(() => {
    if (pixiApp && !viewportRef.current) {
      viewportRef.current = new PixiViewport2D(pixiApp);
      
      // Thêm các đối tượng demo vào viewport
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

  return null; // Component ẩn, chỉ chạy logic PixiJS
}

// Component UI điều khiển viewport
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
    <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-gray-800/90 backdrop-blur p-2 rounded-lg shadow-lg">
      <button 
        onClick={handleZoomOut} 
        className="w-8 h-8 flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded text-white font-bold"
        title="Zoom out"
      >−</button>
      <span className="text-white text-sm w-12 text-center">{zoom}%</span>
      <button 
        onClick={handleZoomIn} 
        className="w-8 h-8 flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded text-white font-bold"
        title="Zoom in"
      >+</button>
      <button 
        onClick={handleReset} 
        className="px-3 h-8 bg-blue-600 hover:bg-blue-500 rounded text-white text-sm"
        title="Reset view"
      >Reset</button>
    </div>
  );
}