import { useEffect, useMemo, useState } from "react";
import { AssetManager } from "../core/AssetManager.ts";
import { Asset } from "../core/Asset.ts";

// Cấu hình thư mục gốc assets - tương thích với cấu trúc TauriReactApp hiện có
const ASSETS_ROOT_FOLDER = "/assets";

// 🛠️ Hàm trợ giúp đơn giản hóa phù hợp Tauri
const filterAssetsByQuery = (assets, query) => {
  if (!query.trim()) return assets;
  const lowerQuery = query.toLowerCase();
  return assets.filter(asset => asset.name.toLowerCase().includes(lowerQuery));
};

// Liệt kê tất cả assets trong một thư mục - tương thích với asset.path hiện có
const listFolderEntries = (assets, folderPath) => {
  return assets.filter(asset => {
    if (folderPath === ASSETS_ROOT_FOLDER) {
      // Kiểm tra asset nằm trực tiếp trong thư mục gốc
      const lastSlashIndex = asset.path.lastIndexOf('/');
      const isInRoot = lastSlashIndex === folderPath.length - 1; // /assets chỉ có 6 ký tự
      return isInRoot;
    }
    return asset.path.startsWith(folderPath + '/') && 
           !asset.path.substring(folderPath.length + 1).includes('/');
  });
};

// Lấy đường dẫn thư mục cha
const getParentFolder = (path) => {
  const lastSlash = path.lastIndexOf('/');
  if (lastSlash <= ASSETS_ROOT_FOLDER.length - 1) return ASSETS_ROOT_FOLDER;
  return path.substring(0, lastSlash);
};

// Hook được tối ưu hoàn toàn cho TauriReactApp
export function useAssetBrowserModel() {
  const assetManager = AssetManager.getInstance();
  
  // 🔄 State quản lý toàn bộ trình duyệt asset
  const [assets, setAssets] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renamingAssetId, setRenamingAssetId] = useState(null);
  const [newAssetName, setNewAssetName] = useState("");
  const [errorMessage, setErrorMessage] = useState(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [folderNameInput, setFolderNameInput] = useState("");

  // 🎧 Lắng nghe thay đổi từ AssetManager (tương thích Tauri API)
  useEffect(() => {
    const updateAssetsList = () => {
      const allAssets = assetManager.getAllAssets();
      setAssets(allAssets);
    };

    // Lần đầu tải danh sách assets
    updateAssetsList();

    // Đăng ký lắng nghe sự kiện của AssetManager hiện có
    assetManager.on('assetAdded', updateAssetsList);
    assetManager.on('assetRemoved', updateAssetsList);
    assetManager.on('assetLoaded', updateAssetsList);

    // Cleanup khi unmount (quan trọng với Tauri SPA)
    return () => {
      assetManager.off('assetAdded', updateAssetsList);
      assetManager.off('assetRemoved', updateAssetsList);
      assetManager.off('assetLoaded', updateAssetsList);
    };
  }, [assetManager]);

  // ✅ Trạng thái tìm kiếm
  const isSearching = searchQuery.trim().length > 0;

  // 📊 Các assets được lọc
  const filteredAssets = useMemo(() => {
    return filterAssetsByQuery(assets, searchQuery);
  }, [assets, searchQuery]);

  // 📁 Các assets trong thư mục gốc
  const rootAssets = useMemo(() => {
    return listFolderEntries(assets, ASSETS_ROOT_FOLDER);
  }, [assets]);

  // 👇 Các phương thức tương tác với assets (tương thích AssetManager hiện có)
  const selectAsset = (assetId) => {
    setSelectedAssetId(assetId);
    // Phát sự kiện cho các panel khác (giữ nguyên như cũ của TauriReactApp)
    window.dispatchEvent(new CustomEvent('assetSelected', { detail: { assetId } }));
  };

  const isAssetSelected = (assetId) => selectedAssetId === assetId;

  // 📝 Đổi tên asset - gọi API AssetManager hiện có
  const renameAsset = async (assetId, name) => {
    setErrorMessage(null);
    try {
      if (!name.trim()) throw new Error("Tên asset không được để trống");
      
      const asset = assetManager.getAsset(assetId);
      if (asset) {
        // Lấy đường dẫn cũ
        const oldPath = asset.path;
        const lastSlashIndex = oldPath.lastIndexOf('/');
        const folderPath = oldPath.substring(0, lastSlashIndex);
        // Tạo đường dẫn mới với tên mới
        const newPath = `${folderPath}/${name.trim()}`;
        
        // Cập nhật asset (asset là object reference nên cập nhật trực tiếp)
        asset.name = name.trim();
        asset.path = newPath;
        asset.modifiedAt = new Date();
        
        // Emit event để cập nhật UI
        assetManager.emit('assetAdded', asset);
      }
      
      setIsRenaming(false);
      setRenamingAssetId(null);
      setNewAssetName("");
      return true;
    } catch (err) {
      setErrorMessage(err.message || "Không thể đổi tên asset");
      return false;
    }
  };

  // 🗑️ Xóa asset - gọi API AssetManager hiện có
  const deleteAsset = async (assetId) => {
    setErrorMessage(null);
    try {
      assetManager.removeAsset(assetId);
      if (selectedAssetId === assetId) setSelectedAssetId(null);
      return true;
    } catch (err) {
      setErrorMessage(err.message || "Không thể xóa asset");
      return false;
    }
  };

  // 🆕 Tạo thư mục mới - tương thích hệ thống Tauri file system
  const createNewFolder = async () => {
    setErrorMessage(null);
    try {
      if (!folderNameInput.trim()) throw new Error("Tên thư mục không được để trống");
      
      // Trong môi trường Tauri, bạn có thể gọi API tauri::fs::create_dir ở đây
      // Ví dụ: await invoke('create_folder', { path: `${ASSETS_ROOT_FOLDER}/${folderNameInput}` });
      
      setFolderNameInput("");
      setShowCreateFolder(false);
      return true;
    } catch (err) {
      setErrorMessage(err.message || "Không thể tạo thư mục");
      return false;
    }
  };

  // 📋 Trả về tất cả state và method cho component sử dụng
  return {
    // Danh sách assets
    rootAssets,
    filteredAssets,
    isSearching,
    searchQuery,
    setSearchQuery,
    
    // State chọn asset
    selectedAssetId,
    selectAsset,
    isAssetSelected,
    
    // State đổi tên
    isRenaming,
    renamingAssetId,
    startRename: (assetId) => {
      const asset = assets.find(a => a.id === assetId);
      if (asset) {
        setNewAssetName(asset.name);
        setRenamingAssetId(assetId);
        setIsRenaming(true);
      }
    },
    cancelRename: () => {
      setIsRenaming(false);
      setRenamingAssetId(null);
      setNewAssetName("");
    },
    newAssetName,
    setNewAssetName,
    renameAsset,
    
    // State xóa
    deleteAsset,
    
    // State tạo thư mục
    showCreateFolder,
    setShowCreateFolder,
    folderNameInput,
    setFolderNameInput,
    createNewFolder,
    
    // Thông báo lỗi
    errorMessage,
    clearError: () => setErrorMessage(null),
    
    // Helper lấy đường dẫn asset
    getAssetContentUrl: (asset) => asset.thumbnail || asset.url || '',
    
    // Helper lấy các mục trong thư mục
    getFolderEntries: (folderPath) => listFolderEntries(assets, folderPath),
  };
}