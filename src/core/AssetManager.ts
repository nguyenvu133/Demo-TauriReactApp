import { Asset, AssetType, AssetStatus } from './Asset';

export class AssetManager {
  private static instance: AssetManager;
  private assets: Map<string, Asset> = new Map();
  private folders: Map<string, string[]> = new Map(); // folder path -> array of asset IDs
  private loadedTextures: Map<string, any> = new Map(); // LÆ°u textures Ä‘Ã£ load cho PixiJS
  private eventListeners: Map<string, Function[]> = new Map();

  private constructor() {
    // Khá»Ÿi táº¡o asset máº·c Ä‘á»‹nh cho demo
    this.setupDemoAssets();
  }

  // Singleton pattern
  public static getInstance(): AssetManager {
    if (!AssetManager.instance) {
      AssetManager.instance = new AssetManager();
    }
    return AssetManager.instance;
  }

  // Thiáº¿t láº­p cÃ¡c assets demo
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

    // ThÃªm vÃ o quáº£n lÃ½
    demoAssets.forEach(asset => this.addAsset(asset));
  }

  // ThÃªm asset má»›i
  public addAsset(asset: Omit<Asset, 'id'>): string {
    const id = `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newAsset: Asset = { ...asset, id };
    this.assets.set(id, newAsset);

    // ThÃªm vÃ o thÆ° má»¥c tÆ°Æ¡ng á»©ng
    const folderPath = asset.path.substring(0, asset.path.lastIndexOf('/')) || '/';
    if (!this.folders.has(folderPath)) {
      this.folders.set(folderPath, []);
    }
    this.folders.get(folderPath)!.push(id);

    // Emit event
    this.emit('assetAdded', newAsset);
    return id;
  }

  // XÃ³a asset
  public removeAsset(id: string): boolean {
    const asset = this.assets.get(id);
    if (!asset) return false;

    // XÃ³a khá»i folder
    const folderPath = asset.path.substring(0, asset.path.lastIndexOf('/')) || '/';
    const folderAssets = this.folders.get(folderPath);
    if (folderAssets) {
      const index = folderAssets.indexOf(id);
      if (index > -1) folderAssets.splice(index, 1);
    }

    // XÃ³a texture náº¿u cÃ³
    if (this.loadedTextures.has(id)) {
      const texture = this.loadedTextures.get(id);
      texture?.destroy?.();
      this.loadedTextures.delete(id);
    }

    this.assets.delete(id);
    this.emit('assetRemoved', id);
    return true;
  }

  // Láº¥y asset theo ID
  public getAsset(id: string): Asset | undefined {
    return this.assets.get(id);
  }

  // Láº¥y táº¥t cáº£ assets
  public getAllAssets(): Asset[] {
    return Array.from(this.assets.values());
  }

  // Láº¥y assets theo loáº¡i
  public getAssetsByType(type: AssetType): Asset[] {
    return Array.from(this.assets.values()).filter(a => a.type === type);
  }

  // Load asset vÃ o PixiJS (cho texture)
  public async loadAssetForPixi(assetId: string): Promise<any> {
    const asset = this.assets.get(assetId);
    if (!asset) throw new Error(`Asset ${assetId} not found`);

    // Náº¿u Ä‘Ã£ load rá»“i thÃ¬ tráº£ vá» luÃ´n
    if (this.loadedTextures.has(assetId)) {
      return this.loadedTextures.get(assetId);
    }

    // Chá»‰ há»— trá»£ load image cho PixiJS trong phiÃªn báº£n nÃ y
    if (asset.type !== AssetType.IMAGE) {
      throw new Error(`Cannot load ${asset.type} asset into PixiJS`);
    }

    try {
      asset.status = AssetStatus.LOADING;
      this.emit('assetLoading', assetId);

      // Táº¡o texture tá»« URL
      const texture = window.PIXI.Assets ? await window.PIXI.Assets.load(asset.path).catch(() => window.PIXI.Texture.from(asset.path)) : window.PIXI.Texture.from(asset.path);
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

  // Táº¡o sprite tá»« asset
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

  // Import assets tá»« thÆ° má»¥c
  public async scanFolder(path: string): Promise<Asset[]> {
    // Trong mÃ´i trÆ°á»ng thá»±c, Ä‘Ã¢y sáº½ gá»i Tauri API Ä‘á»ƒ quÃ©t thÆ° má»¥c
    console.log(`[AssetManager] Scanning folder: ${path}`);
    return [];
  }
}
