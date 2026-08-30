import { Asset, AssetType, AssetStatus } from './Asset';

export class AssetManager {
  private static instance: AssetManager;
  private assets: Map<string, Asset> = new Map();
  private folders: Map<string, string[]> = new Map(); // folder path -> array of asset IDs
  private loadedTextures: Map<string, any> = new Map(); // Lưu textures đã load cho PixiJS
  private eventListeners: Map<string, Function[]> = new Map();

  private constructor() {
    // Khởi tạo asset mặc định cho demo
    this.setupDemoAssets();
  }

  // Singleton pattern
  public static getInstance(): AssetManager {
    if (!AssetManager.instance) {
      AssetManager.instance = new AssetManager();
    }
    return AssetManager.instance;
  }

  // Thiết lập các assets demo
  private setupDemoAssets() {
    const demoAssets: Omit<Asset, 'id'>[] = [
      {
        name: 'player.png',
        path: '/assets/sprites/player.png',
        type: AssetType.IMAGE,
        size: 102400,
        createdAt: new Date(),
        modifiedAt: new Date(),
        status: AssetStatus.LOADED,
        metadata: { width: 128, height: 128, format: 'PNG', colorSpace: 'sRGB' }
      },
      {
        name: 'enemy.png',
        path: '/assets/sprites/enemy.png',
        type: AssetType.IMAGE,
        size: 89120,
        createdAt: new Date(),
        modifiedAt: new Date(),
        status: AssetStatus.LOADED,
        metadata: { width: 96, height: 96, format: 'PNG', colorSpace: 'sRGB' }
      },
      {
        name: 'background.mp3',
        path: '/assets/audio/background.mp3',
        type: AssetType.AUDIO,
        size: 5242880,
        createdAt: new Date(),
        modifiedAt: new Date(),
        status: AssetStatus.LOADED,
        metadata: { duration: 180, channels: 2, sampleRate: 44100, bitrate: 320000 }
      },
      {
        name: 'tileset.json',
        path: '/assets/tiles/tileset.json',
        type: AssetType.TILESET,
        size: 24567,
        createdAt: new Date(),
        modifiedAt: new Date(),
        status: AssetStatus.LOADED,
        metadata: { tileWidth: 32, tileHeight: 32, tilesetWidth: 10, tilesetHeight: 8 }
      },
      {
        name: 'level1.scene',
        path: '/assets/scenes/level1.scene',
        type: AssetType.SCENE,
        size: 156789,
        createdAt: new Date(),
        modifiedAt: new Date(),
        status: AssetStatus.LOADED,
        metadata: { width: 1920, height: 1080, gravity: 9.8 }
      },
      {
        name: 'character.spine',
        path: '/assets/animations/character.spine',
        type: AssetType.SPINE,
        size: 789456,
        createdAt: new Date(),
        modifiedAt: new Date(),
        status: AssetStatus.LOADED,
        metadata: { skeleton: true, atlas: true, animationCount: 5, skinCount: 3 }
      },
      {
        name: 'level3d.glb',
        path: '/assets/models/level3d.glb',
        type: AssetType.GLTF,
        size: 12582912,
        createdAt: new Date(),
        modifiedAt: new Date(),
        status: AssetStatus.LOADED,
        metadata: { meshes: 15, materials: 8, animations: 3, nodes: 25, textures: 12 }
      }
    ];

    // Thêm vào quản lý
    demoAssets.forEach(asset => this.addAsset(asset));
  }

  // Thêm asset mới
  public addAsset(asset: Omit<Asset, 'id'>): string {
    const id = `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newAsset: Asset = { ...asset, id };
    this.assets.set(id, newAsset);

    // Thêm vào thư mục tương ứng
    const folderPath = asset.path.substring(0, asset.path.lastIndexOf('/')) || '/';
    if (!this.folders.has(folderPath)) {
      this.folders.set(folderPath, []);
    }
    this.folders.get(folderPath)!.push(id);

    // Emit event
    this.emit('assetAdded', newAsset);
    return id;
  }

  // Xóa asset
  public removeAsset(id: string): boolean {
    const asset = this.assets.get(id);
    if (!asset) return false;

    // Xóa khỏi folder
    const folderPath = asset.path.substring(0, asset.path.lastIndexOf('/')) || '/';
    const folderAssets = this.folders.get(folderPath);
    if (folderAssets) {
      const index = folderAssets.indexOf(id);
      if (index > -1) folderAssets.splice(index, 1);
    }

    // Xóa texture nếu có
    if (this.loadedTextures.has(id)) {
      const texture = this.loadedTextures.get(id);
      texture?.destroy?.();
      this.loadedTextures.delete(id);
    }

    this.assets.delete(id);
    this.emit('assetRemoved', id);
    return true;
  }

  // Lấy asset theo ID
  public getAsset(id: string): Asset | undefined {
    return this.assets.get(id);
  }

  // Lấy tất cả assets
  public getAllAssets(): Asset[] {
    return Array.from(this.assets.values());
  }

  // Lấy assets theo loại
  public getAssetsByType(type: AssetType): Asset[] {
    return Array.from(this.assets.values()).filter(a => a.type === type);
  }

  // Load asset vào PixiJS (cho texture)
  public async loadAssetForPixi(assetId: string): Promise<any> {
    const asset = this.assets.get(assetId);
    if (!asset) throw new Error(`Asset ${assetId} not found`);

    // Nếu đã load rồi thì trả về luôn
    if (this.loadedTextures.has(assetId)) {
      return this.loadedTextures.get(assetId);
    }

    // Chỉ hỗ trợ load image cho PixiJS trong phiên bản này
    if (asset.type !== AssetType.IMAGE) {
      throw new Error(`Cannot load ${asset.type} asset into PixiJS`);
    }

    try {
      asset.status = AssetStatus.LOADING;
      this.emit('assetLoading', assetId);

      // Tạo texture từ URL
      const texture = await window.PIXI.Texture.fromURL(asset.path);
      this.loadedTextures.set(assetId, texture);
      
      asset.status = AssetStatus.LOADED;
      this.emit('assetLoaded', assetId);
      return texture;
    } catch (error) {
      asset.status = AssetStatus.ERROR;
      this.emit('assetLoadError', { assetId, error });
      throw error;
    }
  }

  // Tạo sprite từ asset
  public async createSpriteFromAsset(assetId: string) {
    const texture = await this.loadAssetForPixi(assetId);
    return new window.PIXI.Sprite(texture);
  }

  // Event system
  public on(event: string, callback: Function) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  public off(event: string, callback: Function) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) listeners.splice(index, 1);
    }
  }

  private emit(event: string, data: any) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  // Import assets từ thư mục
  public async scanFolder(path: string): Promise<Asset[]> {
    // Trong môi trường thực, đây sẽ gọi Tauri API để quét thư mục
    console.log(`[AssetManager] Scanning folder: ${path}`);
    return [];
  }
}