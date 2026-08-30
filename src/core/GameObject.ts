// PixiJS được load qua CDN, dùng window.PIXI
declare const PIXI: any;

// Interface cho Script Component
export interface GameScript {
  id: string;
  name: string;
  source: string; // Mã nguồn JS/TS
  isEnabled: boolean;
  start?: (gameObject: GameObject) => void;
  update?: (gameObject: GameObject, delta: number) => void;
  onDestroy?: (gameObject: GameObject) => void;
  instance: any; // Instance của script sau khi chạy
}

// Lớp cơ sở cho tất cả các game objects
export class GameObject {
  public id: string;
  public name: string;
  public type: string;
  public pixiObject: any;
  public tags: string[] = [];
  public isActive: boolean = true;
  public children: GameObject[] = [];
  public parent: GameObject | null = null;
  public scripts: GameScript[] = []; // Mảng chứa các script gắn vào object

  private static nextId: number = 0;

  constructor(name: string, type: string, pixiObject: any) {
    this.id = `obj_${GameObject.nextId++}`;
    this.name = name;
    this.type = type;
    this.pixiObject = pixiObject;
  }

  // Lấy vị trí
  get position(): { x: number; y: number } {
    if ('x' in this.pixiObject && 'y' in this.pixiObject) {
      return { x: (this.pixiObject as any).x, y: (this.pixiObject as any).y };
    }
    return { x: 0, y: 0 };
  }

  // Đặt vị trí
  set position({ x, y }: { x: number; y: number }) {
    if ('x' in this.pixiObject && 'y' in this.pixiObject) {
      (this.pixiObject as any).x = x;
      (this.pixiObject as any).y = y;
    }
  }

  // Lấy tỷ lệ
  get scale(): { x: number; y: number } {
    if ('scale' in this.pixiObject) {
      const scale = (this.pixiObject as any).scale;
      return { x: scale.x, y: scale.y };
    }
    return { x: 1, y: 1 };
  }

  // Đặt tỷ lệ
  set scale({ x, y }: { x: number; y: number }) {
    if ('scale' in this.pixiObject) {
      (this.pixiObject as any).scale.set(x, y);
    }
  }

  // Lấy độ xoay
  get rotation(): number {
    if ('rotation' in this.pixiObject) {
      return (this.pixiObject as any).rotation;
    }
    return 0;
  }

  // Đặt độ xoay
  set rotation(rotation: number) {
    if ('rotation' in this.pixiObject) {
      (this.pixiObject as any).rotation = rotation;
    }
  }

  // Lấy độ trong suốt
  get alpha(): number {
    return this.pixiObject.alpha;
  }

  // Đặt độ trong suốt
  set alpha(alpha: number) {
    this.pixiObject.alpha = alpha;
  }

  // Trạng thái hiển thị
  get visible(): boolean {
    return this.pixiObject.visible;
  }

  set visible(visible: boolean) {
    this.pixiObject.visible = visible;
  }

  // Thêm child
  addChild(child: GameObject) {
    this.children.push(child);
    child.parent = this;
    
    if (this.pixiObject instanceof PIXI.Container) {
      this.pixiObject.addChild(child.pixiObject);
    }
  }

  // Xóa child
  removeChild(child: GameObject) {
    const index = this.children.indexOf(child);
    if (index > -1) {
      this.children.splice(index, 1);
      child.parent = null;
      
      if (this.pixiObject instanceof PIXI.Container) {
        this.pixiObject.removeChild(child.pixiObject);
      }
    }
  }

  // Xóa khỏi scene
  destroy() {
    // Xóa khỏi parent
    if (this.parent) {
      this.parent.removeChild(this);
    }

    // Xóa tất cả children
    [...this.children].forEach(child => this.removeChild(child));

    // Xóa khỏi PixiJS stage
    this.pixiObject.destroy();
  }

  // Thêm script vào object
  public addScript(script: GameScript) {
    this.scripts.push(script);
    // Gọi hàm start khi script được thêm
    if (script.isEnabled && script.start) {
      try {
        script.start(this);
      } catch (e) {
        console.error(`Lỗi trong script ${script.name}:`, e);
      }
    }
  }

  // Xóa script khỏi object
  public removeScript(scriptId: string) {
    const scriptIndex = this.scripts.findIndex(s => s.id === scriptId);
    if (scriptIndex !== -1) {
      const script = this.scripts[scriptIndex];
      if (script.onDestroy) {
        try {
          script.onDestroy(this);
        } catch (e) {
          console.error(`Lỗi trong onDestroy của script ${script.name}:`, e);
        }
      }
      this.scripts.splice(scriptIndex, 1);
    }
  }

  // Cập nhật mỗi frame
  public update(deltaTime: number) {
    if (!this.isActive) return;
    
    // Cập nhật tất cả scripts
    this.scripts.forEach(script => {
      if (script.isEnabled && script.update) {
        try {
          script.update(this, deltaTime);
        } catch (e) {
          console.error(`Lỗi trong update của script ${script.name}:`, e);
        }
      }
    });
    
    // Gọi update cho tất cả children
    this.children.forEach(child => child.update(deltaTime));
  }
}

// Các lớp chuyên biệt cho loại đối tượng cụ thể
export class RectObject extends GameObject {
  constructor(name: string, width: number, height: number, fillColor: number = 0x4a9eff) {
    const graphics = new PIXI.Graphics();
    graphics.beginFill(fillColor);
    graphics.drawRect(0, 0, width, height);
    graphics.endFill();
    
    super(name, 'rectangle', graphics);
  }

  get graphics(): any {
    return this.pixiObject;
  }
}

export class CircleObject extends GameObject {
  constructor(name: string, radius: number, fillColor: number = 0xff6b6b) {
    const graphics = new PIXI.Graphics();
    graphics.beginFill(fillColor);
    graphics.drawCircle(0, 0, radius);
    graphics.endFill();
    
    super(name, 'circle', graphics);
  }

  get graphics(): any {
    return this.pixiObject;
  }
}

export class SpriteObject extends GameObject {
  constructor(name: string, texture: any) {
    const sprite = new PIXI.Sprite(texture);
    
    super(name, 'sprite', sprite);
  }

  get sprite(): any {
    return this.pixiObject;
  }
}

export class ContainerObject extends GameObject {
  constructor(name: string) {
    const container = new PIXI.Container();
    
    super(name, 'container', container);
  }

  get container(): any {
    return this.pixiObject;
  }
}