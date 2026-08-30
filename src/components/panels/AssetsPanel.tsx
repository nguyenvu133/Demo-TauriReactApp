import { useState, useRef } from 'react';
import { Asset, AssetIcons, AssetColors } from '../../core/Asset';
// @ts-ignore: JS module without TypeScript declarations
import { useAssetBrowserModel } from '../../hooks/useAssetBrowserModel';

// View modes cho panel assets
type ViewMode = 'grid' | 'list' | 'detail';

export function AssetsPanel() {
  // Sử dụng useAssetBrowserModel đã tối ưu cho TauriReactApp
  const {
    rootAssets,
    searchQuery,
    setSearchQuery,
    isSearching,
    selectAsset,
    isAssetSelected,
    isRenaming,
    renamingAssetId,
    newAssetName,
    setNewAssetName,
    renameAsset,
    cancelRename,
    startRename,
    deleteAsset,
    showCreateFolder,
    setShowCreateFolder,
    folderNameInput,
    setFolderNameInput,
    createNewFolder,
    errorMessage,
  } = useAssetBrowserModel();
  
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [currentFolder, setCurrentFolder] = useState<string>('/assets');
  const panelRef = useRef<HTMLDivElement>(null);

  // Lọc assets theo tìm kiếm và thư mục - hoàn toàn tương thích với cấu trúc cũ
  const filteredAssets = isSearching 
    ? rootAssets.filter((asset: Asset) => 
        asset.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : rootAssets.filter((asset: Asset) => {
        const inFolder = asset.path.startsWith(currentFolder);
        return inFolder;
      });

  // Xử lý kéo thả asset vào game view (giữ nguyên như cũ)
  const handleDragStart = (e: React.DragEvent, asset: Asset) => {
    e.dataTransfer.setData('assetId', asset.id);
    e.dataTransfer.setData('assetType', asset.type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  // Xử lý click vào asset
  const handleAssetClick = (asset: Asset) => {
    selectAsset(asset.id);
    // Phát sự kiện để InspectorPanel hiển thị chi tiết asset (giữ nguyên như cũ)
    (window as any).gameEditor?.emit('assetSelected', asset);
  };

  // Hiển thị card asset trong chế độ grid
  const renderAssetCard = (asset: Asset) => {
    const isSelected = isAssetSelected(asset.id);
    const isRenamingThis = isRenaming && renamingAssetId === asset.id;
    const backgroundColor = isSelected ? '#3b82f6' : AssetColors[asset.type];
    
    return (
      <div
        key={asset.id}
        draggable
        onDragStart={(e) => handleDragStart(e, asset)}
        onClick={() => handleAssetClick(asset)}
        className={`
          relative flex flex-col items-center p-3 rounded-lg cursor-pointer
          transition-all duration-200 hover:bg-gray-700 border-2
          ${isSelected ? 'border-blue-500 bg-gray-700' : 'border-transparent'}
        `}
      >
        {/* Thumbnail hoặc icon */}
        <div 
          className="w-16 h-16 flex items-center justify-center rounded-lg mb-2 text-2xl shadow-md"
          style={{ backgroundColor: backgroundColor + '30' }}
        >
          {asset.thumbnail ? (
            <img src={asset.thumbnail} alt={asset.name} className="w-full h-full object-cover rounded" />
          ) : (
            AssetIcons[asset.type]
          )}
        </div>
        
        {/* Tên file hoặc input đổi tên */}
        {isRenamingThis ? (
          <input
            type="text"
            value={newAssetName}
            onChange={(e) => setNewAssetName(e.target.value)}
            onBlur={() => renameAsset(asset.id, newAssetName)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') renameAsset(asset.id, newAssetName);
              if (e.key === 'Escape') cancelRename();
            }}
            className="text-xs bg-gray-700 border border-blue-500 rounded px-1 py-0.5 w-full text-center outline-none"
            autoFocus
          />
        ) : (
          <span className="text-xs text-gray-300 truncate w-full text-center leading-tight">
            {asset.name}
          </span>
        )}
        
        {/* Context menu actions */}
        <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); startRename(asset.id); }}
            className="p-1 hover:bg-gray-600 rounded text-xs"
            title="Đổi tên"
          >
            ✏️
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); if (confirm('Xóa asset này?')) deleteAsset(asset.id); }}
            className="p-1 hover:bg-gray-600 rounded text-xs"
            title="Xóa"
          >
            🗑️
          </button>
        </div>
        
        {/* Trạng thái badge */}
        {asset.status !== 'loaded' && (
          <div className="absolute top-2 right-2">
            {asset.status === 'loading' && <span className="text-yellow-400">⏳</span>}
            {asset.status === 'error' && <span className="text-red-400">❌</span>}
          </div>
        )}
      </div>
    );
  };

  // Hiển thị item asset trong chế độ list
  const renderAssetListItem = (asset: Asset) => {
    const isSelected = isAssetSelected(asset.id);
    const isRenamingThis = isRenaming && renamingAssetId === asset.id;
    
    return (
      <div
        key={asset.id}
        draggable
        onDragStart={(e) => handleDragStart(e, asset)}
        onClick={() => handleAssetClick(asset)}
        className={`
          flex items-center gap-3 px-3 py-2 cursor-pointer transition-all
          hover:bg-gray-700 border-b border-gray-800 group
          ${isSelected ? 'bg-blue-900/30' : ''}
        `}
      >
        <span className="text-xl">{AssetIcons[asset.type]}</span>
        {isRenamingThis ? (
          <input
            type="text"
            value={newAssetName}
            onChange={(e) => setNewAssetName(e.target.value)}
            onBlur={() => renameAsset(asset.id, newAssetName)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') renameAsset(asset.id, newAssetName);
              if (e.key === 'Escape') cancelRename();
            }}
            className="flex-1 text-sm bg-gray-700 border border-blue-500 rounded px-2 py-1 outline-none"
            autoFocus
          />
        ) : (
          <span className="flex-1 text-sm text-gray-300">{asset.name}</span>
        )}
        <span className="text-xs text-gray-500">{(asset.size / 1024).toFixed(1)} KB</span>
        <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: AssetColors[asset.type] + '30' }}>
          {asset.type}
        </span>
        <div className="hidden group-hover:flex gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); startRename(asset.id); }}
            className="p-1 hover:bg-gray-600 rounded"
            title="Đổi tên"
          >
            ✏️
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); if (confirm('Xóa asset này?')) deleteAsset(asset.id); }}
            className="p-1 hover:bg-gray-600 rounded"
            title="Xóa"
          >
            🗑️
          </button>
        </div>
      </div>
    );
  };

  // Cây thư mục
  const folders: string[] = ['/assets', '/assets/sprites', '/assets/audio', '/assets/tiles', '/assets/scenes', '/assets/animations', '/assets/models'];

  return (
    <div ref={panelRef} className="w-full h-full flex flex-col bg-gray-900 text-white overflow-hidden">
      {/* Header toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-gray-800 bg-gray-850">
        <button 
          onClick={() => setShowCreateFolder(true)} 
          className="p-1.5 hover:bg-gray-700 rounded transition-colors"
          title="Tạo thư mục mới"
        >
          ➕
        </button>
        <button 
          onClick={() => {}} 
          className="p-1.5 hover:bg-gray-700 rounded transition-colors"
          title="Tải lên"
        >
          📤
        </button>
        <div className="flex-1"></div>
        
        {/* Nút chuyển view mode */}
        <button 
          onClick={() => setViewMode('grid')}
          className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-gray-700' : 'hover:bg-gray-700'}`}
          title="Grid view"
        >
          ⊞
        </button>
        <button 
          onClick={() => setViewMode('list')}
          className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-gray-700' : 'hover:bg-gray-700'}`}
          title="List view"
        >
          ☰
        </button>
      </div>

      {/* Thanh tìm kiếm */}
      <div className="p-2 border-b border-gray-800">
        <input
          type="text"
          placeholder="Tìm kiếm assets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm outline-none focus:border-blue-500"
        />
      </div>

      {/* Hiển thị thông báo lỗi */}
      {errorMessage && (
        <div className="mx-2 mt-2 p-2 bg-red-900/50 border border-red-500 rounded text-red-300 text-xs">
          ❌ {errorMessage}
        </div>
      )}

      {/* Form tạo thư mục mới */}
      {showCreateFolder && (
        <div className="mx-2 mt-2 p-3 bg-gray-800 border border-gray-700 rounded">
          <h4 className="text-sm font-semibold mb-2">Tạo thư mục mới</h4>
          <input
            type="text"
            placeholder="Tên thư mục..."
            value={folderNameInput}
            onChange={(e) => setFolderNameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') createNewFolder();
              if (e.key === 'Escape') setShowCreateFolder(false);
            }}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm outline-none focus:border-blue-500 mb-2"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowCreateFolder(false)}
              className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs"
            >
              Hủy
            </button>
            <button
              onClick={createNewFolder}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs"
            >
              Tạo
            </button>
          </div>
        </div>
      )}

      {/* Cây thư mục bên trái */}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-40 border-r border-gray-800 p-2 overflow-y-auto">
          {folders.map(folder => (
            <div
              key={folder}
              onClick={() => setCurrentFolder(folder)}
              className={`
                px-2 py-1.5 rounded cursor-pointer text-xs mb-1 truncate
                ${currentFolder === folder ? 'bg-blue-600' : 'hover:bg-gray-800'}
              `}
            >
              📁 {folder.split('/').pop()}
            </div>
          ))}
        </div>

        {/* Danh sách assets bên phải */}
        <div className="flex-1 overflow-y-auto p-2">
          {viewMode === 'grid' ? (
              <div className="grid grid-cols-3 gap-2">
                {filteredAssets.map((asset: Asset) => renderAssetCard(asset))}
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {filteredAssets.map((asset: Asset) => renderAssetListItem(asset))}
              </div>
            )}
          
          {filteredAssets.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <span className="text-4xl mb-2">📂</span>
              <p>Không có assets trong thư mục này</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}