import { useState, useRef } from 'react';
import { Asset, AssetIcons, AssetColors } from '../../core/Asset';
import { useAssetBrowserModel } from '../../hooks/useAssetBrowserModel';

type ViewMode = 'grid' | 'list' | 'detail';

export function AssetsPanel() {
  const {
    assets,
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

  const filteredAssets = isSearching 
    ? (assets || []).filter((asset: Asset) => 
        asset.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : (assets || []).filter((asset: Asset) => {
        if (currentFolder === '/assets') return true;
        return asset.path.startsWith(currentFolder);
      });

  const handleDragStart = (e: React.DragEvent, asset: Asset) => {
    e.dataTransfer.setData('assetId', asset.id);
    e.dataTransfer.setData('assetType', asset.type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleAssetClick = (asset: Asset) => {
    selectAsset(asset.id);
    (window as any).gameEditor?.emit('assetSelected', asset);
  };

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
          transition-all duration-200 hover:bg-gray-800 border-2 group
          ${isSelected ? 'border-blue-500 bg-gray-800' : 'border-transparent bg-gray-900/60'}
        `}
      >
        <div 
          className="w-16 h-16 flex items-center justify-center rounded-lg mb-2 text-2xl shadow-md"
          style={{ backgroundColor: backgroundColor + '30' }}
        >
          {asset.thumbnail ? (
            <img src={asset.thumbnail} alt={asset.name} className="w-full h-full object-cover rounded" />
          ) : (
            AssetIcons[asset.type] || '📦'
          )}
        </div>
        
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
            className="text-xs bg-gray-700 border border-blue-500 rounded px-1 py-0.5 w-full text-center outline-none text-white"
            autoFocus
          />
        ) : (
          <span className="text-xs text-gray-300 truncate w-full text-center leading-tight">
            {asset.name}
          </span>
        )}
        
        <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); startRename(asset.id); }}
            className="p-1 hover:bg-gray-600 rounded text-xs text-gray-300"
            title="Đổi tên"
          >
            ✏️
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); if (confirm('Xóa asset này?')) deleteAsset(asset.id); }}
            className="p-1 hover:bg-gray-600 rounded text-xs text-gray-300"
            title="Xóa"
          >
            🗑️
          </button>
        </div>
        
        {asset.status !== 'loaded' && (
          <div className="absolute top-2 right-2">
            {asset.status === 'loading' && <span className="text-yellow-400">⏳</span>}
            {asset.status === 'error' && <span className="text-red-400">❌</span>}
          </div>
        )}
      </div>
    );
  };

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
          hover:bg-gray-800 border-b border-gray-800 group
          ${isSelected ? 'bg-blue-900/30' : ''}
        `}
      >
        <span className="text-xl">{AssetIcons[asset.type] || '📦'}</span>
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
            className="flex-1 text-sm bg-gray-700 border border-blue-500 rounded px-2 py-1 outline-none text-white"
            autoFocus
          />
        ) : (
          <span className="flex-1 text-sm text-gray-300">{asset.name}</span>
        )}
        <span className="text-xs text-gray-500">{(asset.size / 1024).toFixed(1)} KB</span>
        <span className="text-xs px-2 py-0.5 rounded text-gray-300" style={{ backgroundColor: AssetColors[asset.type] + '30' }}>
          {asset.type}
        </span>
        <div className="hidden group-hover:flex gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); startRename(asset.id); }}
            className="p-1 hover:bg-gray-600 rounded text-xs text-gray-300"
            title="Đổi tên"
          >
            ✏️
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); if (confirm('Xóa asset này?')) deleteAsset(asset.id); }}
            className="p-1 hover:bg-gray-600 rounded text-xs text-gray-300"
            title="Xóa"
          >
            🗑️
          </button>
        </div>
      </div>
    );
  };

  const folders: string[] = ['/assets', '/assets/sprites', '/assets/audio', '/assets/tiles', '/assets/scenes', '/assets/animations', '/assets/models'];

  return (
    <div ref={panelRef} className="w-full h-full flex flex-col bg-gray-950 text-white overflow-hidden">
      {/* Header toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-gray-800 bg-gray-900 shrink-0">
        <button 
          onClick={() => setShowCreateFolder(true)} 
          className="p-1.5 hover:bg-gray-800 rounded transition-colors text-gray-300"
          title="Tạo thư mục mới"
        >
          ➕
        </button>
        <button 
          onClick={() => {}} 
          className="p-1.5 hover:bg-gray-800 rounded transition-colors text-gray-300"
          title="Tải lên"
        >
          📤
        </button>
        <div className="flex-1"></div>
        
        <button 
          onClick={() => setViewMode('grid')}
          className={`p-1.5 rounded text-sm ${viewMode === 'grid' ? 'bg-gray-800 text-blue-400' : 'hover:bg-gray-800 text-gray-400'}`}
          title="Grid view"
        >
          ⊞
        </button>
        <button 
          onClick={() => setViewMode('list')}
          className={`p-1.5 rounded text-sm ${viewMode === 'list' ? 'bg-gray-800 text-blue-400' : 'hover:bg-gray-800 text-gray-400'}`}
          title="List view"
        >
          ☰
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-2 border-b border-gray-800 shrink-0">
        <input
          type="text"
          placeholder="Tìm kiếm assets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-gray-900 border border-gray-800 rounded px-3 py-1.5 text-sm text-gray-200 outline-none focus:border-blue-500"
        />
      </div>

      {errorMessage && (
        <div className="mx-2 mt-2 p-2 bg-red-900/50 border border-red-500 rounded text-red-300 text-xs">
          ❌ {errorMessage}
        </div>
      )}

      {showCreateFolder && (
        <div className="mx-2 mt-2 p-3 bg-gray-900 border border-gray-800 rounded">
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
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm outline-none focus:border-blue-500 mb-2 text-white"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowCreateFolder(false)}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
            >
              Hủy
            </button>
            <button
              onClick={createNewFolder}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs text-white"
            >
              Tạo
            </button>
          </div>
        </div>
      )}

      {/* Directory tree & asset list */}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-36 border-r border-gray-800 p-2 overflow-y-auto shrink-0">
          {folders.map(folder => (
            <div
              key={folder}
              onClick={() => setCurrentFolder(folder)}
              className={`
                px-2 py-1.5 rounded cursor-pointer text-xs mb-1 truncate transition-colors
                ${currentFolder === folder ? 'bg-blue-600 text-white font-medium' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}
              `}
            >
              📁 {folder.split('/').pop()}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {viewMode === 'grid' ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
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
              <p className="text-xs">Không có assets trong thư mục này</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AssetsPanel;
