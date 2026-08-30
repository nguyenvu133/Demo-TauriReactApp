// Các loại tài nguyên được hỗ trợ
export enum AssetType {
  IMAGE = 'image',
  AUDIO = 'audio',
  TILEMAP = 'tilemap',
  TILESET = 'tileset',
  SPINE = 'spine',
  GLTF = 'gltf',
  SCENE = 'scene',
  SCRIPT = 'script',
  FONT = 'font',
  VIDEO = 'video'
}

// Trạng thái của asset
export enum AssetStatus {
  UNLOADED = 'unloaded',
  LOADING = 'loading',
  LOADED = 'loaded',
  ERROR = 'error'
}

// Interface cơ bản cho mọi tài nguyên
export interface Asset {
  id: string;           // ID duy nhất
  name: string;         // Tên file
  path: string;         // Đường dẫn tương đối trong dự án
  type: AssetType;      // Loại asset
  size: number;         // Kích thước file (bytes)
  createdAt: Date;      // Ngày tạo
  modifiedAt: Date;     // Ngày sửa đổi
  status: AssetStatus;  // Trạng thái
  metadata: Record<string, any>; // Dữ liệu phụ thuộc loại asset
  thumbnail?: string;   // Data URL của thumbnail (nếu có)
}

// Metadata cụ thể cho từng loại asset
export interface ImageAssetMetadata {
  width: number;
  height: number;
  format: string;
  colorSpace: string;
}

export interface AudioAssetMetadata {
  duration: number;
  channels: number;
  sampleRate: number;
  bitrate: number;
}

export interface TilemapAssetMetadata {
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  layers: number;
}

export interface SpineAssetMetadata {
  skeleton: boolean;
  atlas: boolean;
  animationCount: number;
  skinCount: number;
}

export interface GltfAssetMetadata {
  meshes: number;
  materials: number;
  animations: number;
  nodes: number;
  textures: number;
}

// Danh sách icon cho từng loại asset
export const AssetIcons: Record<AssetType, string> = {
  [AssetType.IMAGE]: '🖼️',
  [AssetType.AUDIO]: '🎵',
  [AssetType.TILEMAP]: '🗺️',
  [AssetType.TILESET]: '🧱',
  [AssetType.SPINE]: '🦴',
  [AssetType.GLTF]: '📦',
  [AssetType.SCENE]: '🎬',
  [AssetType.SCRIPT]: '📝',
  [AssetType.FONT]: '🔤',
  [AssetType.VIDEO]: '🎥'
};

// Danh sách màu nền cho từng loại asset
export const AssetColors: Record<AssetType, string> = {
  [AssetType.IMAGE]: '#4ade80',
  [AssetType.AUDIO]: '#60a5fa',
  [AssetType.TILEMAP]: '#f472b6',
  [AssetType.TILESET]: '#fbbf24',
  [AssetType.SPINE]: '#a78bfa',
  [AssetType.GLTF]: '#34d399',
  [AssetType.SCENE]: '#f87171',
  [AssetType.SCRIPT]: '#94a3b8',
  [AssetType.FONT]: '#22d3d1',
  [AssetType.VIDEO]: '#fb923c'
};

// Hàm tiện ích xác định loại asset từ tên file
export function getAssetTypeFromFilename(filename: string): AssetType {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  
  const imageExts = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'];
  const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'aac'];
  const tilemapExts = ['tmj', 'tmx', 'json'];
  const spineExts = ['skel', 'json'];
  const gltfExts = ['gltf', 'glb'];
  const sceneExts = ['scene', 'level'];
  const scriptExts = ['ts', 'js', 'lua', 'cs'];
  const fontExts = ['ttf', 'otf', 'woff', 'woff2'];
  const videoExts = ['mp4', 'webm', 'avi'];

  if (imageExts.includes(ext)) return AssetType.IMAGE;
  if (audioExts.includes(ext)) return AssetType.AUDIO;
  if (spineExts.includes(ext) && filename.includes('skeleton')) return AssetType.SPINE;
  if (gltfExts.includes(ext)) return AssetType.GLTF;
  if (sceneExts.includes(ext)) return AssetType.SCENE;
  if (scriptExts.includes(ext)) return AssetType.SCRIPT;
  if (fontExts.includes(ext)) return AssetType.FONT;
  if (videoExts.includes(ext)) return AssetType.VIDEO;
  
  // Kiểm tra nếu là tileset
  if (filename.toLowerCase().includes('tileset') && (ext === 'json' || ext === 'png')) {
    return AssetType.TILESET;
  }
  
  // Kiểm tra nếu là tilemap
  if (tilemapExts.includes(ext)) return AssetType.TILEMAP;

  // Mặc định nếu không xác định được
  return AssetType.IMAGE;
}