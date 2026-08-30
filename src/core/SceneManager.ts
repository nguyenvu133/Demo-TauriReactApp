// PixiJS được load qua CDN, dùng window.PIXI
declare const PIXI: any;
import { GameObject } from './GameObject';

// Singleton quản lý toàn bộ scene và game objects
export class SceneManager {
  private static instance: SceneManager;
  
  private rootContainer: any;
  private gameObjects: Map<string, GameObject> = new Map();
  private selectedObject: GameObject | null = null;
  private isRunning: boolean = false;

  private constructor() {
    this.rootContainer = new PIXI.Container();
    this.rootContainer.sortableChildren = true;
  }

  // Lấy instance duy nhất
  public static getInstance(): SceneManager {
    if (!SceneManager.instance) {
      SceneManager.instance = new SceneManager();
    }
    return SceneManager.instance;
  }

  // Khởi tạo với PixiJS app
  public init(pixiApp: any) {
    // Thêm root container vào stage của PixiJS
    pixiApp.stage.addChild(this.rootContainer);
    
    // Bắt đầu loop cập nhật
    this.startUpdateLoop(pixiApp);
  }

  // Thêm game object vào scene
  public addObject(gameObject: GameObject): GameObject {
    this.gameObjects.set(gameObject.id, gameObject);
    this.rootContainer.addChild(gameObject.pixiObject);
    
    // Phát sự kiện đối tượng được thêm
    window.dispatchEvent(new CustomEvent('gameObjectAdded', { detail: gameObject }));
    
    return gameObject;
  }

  // Xóa game object khỏi scene
  public removeObject(id: string): boolean {
    const object = this.gameObjects.get(id);
    if (object) {
      // Nếu đang chọn đối tượng này thì bỏ chọn
      if (this.selectedObject?.id === id) {
        this.setSelectedObject(null);
      }
      
      // Xóa khỏi root container
      this.rootContainer.removeChild(object.pixiObject);
      this.gameObjects.delete(id);
      object.destroy();
      
      // Phát sự kiện đối tượng bị xóa
      window.dispatchEvent(new CustomEvent('gameObjectRemoved', { detail: object }));
      return true;
    }
    return false;
  }

  // Lấy game object theo ID
  public getObject(id: string): GameObject | undefined {
    return this.gameObjects.get(id);
  }

  // Lấy tất cả game objects
  public getAllObjects(): GameObject[] {
    return Array.from(this.gameObjects.values());
  }

  // Tìm đối tượng theo tên
  public findObjectByName(name: string): GameObject | undefined {
    return Array.from(this.gameObjects.values()).find(obj => obj.name === name);
  }

  // Tìm các đối tượng theo tag
  public findObjectsByTag(tag: string): GameObject[] {
    return Array.from(this.gameObjects.values()).filter(obj => obj.tags.includes(tag));
  }

  // Chọn đối tượng
  public setSelectedObject(object: GameObject | null) {
    this.selectedObject = object;
    
    // Phát sự kiện đối tượng được chọn
    window.dispatchEvent(new CustomEvent('objectSelected', { detail: object }));
  }

  // Lấy đối tượng đang được chọn
  public getSelectedObject(): GameObject | null {
    return this.selectedObject;
  }

  // Lấy container gốc của scene
  public getRootContainer(): any {
    return this.rootContainer;
  }

  // Bắt đầu loop cập nhật
  private startUpdateLoop(pixiApp: any) {
    if (this.isRunning) return;
    this.isRunning = true;

    // Hook vào ticker của PixiJS để cập nhật mỗi frame
    pixiApp.ticker.add((delta: number) => {
      if (!this.isRunning) return;
      
      // Cập nhật tất cả game objects
      this.gameObjects.forEach(obj => obj.update(delta));
    });
  }

  // Dừng loop cập nhật
  public stop() {
    this.isRunning = false;
  }

  // Tiếp tục loop cập nhật
  public resume() {
    this.isRunning = true;
  }

  // Xóa toàn bộ đối tượng trong scene
  public clearScene() {
    this.gameObjects.forEach(obj => {
      this.rootContainer.removeChild(obj.pixiObject);
      obj.destroy();
    });
    this.gameObjects.clear();
    this.setSelectedObject(null);
  }
}