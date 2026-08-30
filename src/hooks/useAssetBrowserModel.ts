import { useEffect, useMemo, useState } from "react";
import { AssetManager } from "../core/AssetManager.ts";
// Import type cho interface Asset (chỉ dùng cho TypeScript kiểm tra kiểu)
import type { Asset } from "../core/Asset.ts";

// Cấu hình thư mục gốc assets - tương thích với cấu trúc TauriReactApp hiện có
const ASSETS_ROOT_FOLDER = "/assets";

// 🛠️ Hàm trợ giúp đơn giản hóa phù hợp Tauri
const filterAssetsByQuery = (assets: Asset[], query: string): Asset[] => {
  if (!query.trim()) return assets;
  const lowerQuery = query.toLowerCase();
  return assets.filter(asset => asset.name.toLowerCase().includes(lowerQuery));
};

// Liệt kê tất cả assets trong một thư mục - tương thích với asset.path hiện có
const listFolderEntries = (assets: Asset[], folderPath: string): Asset[] => {
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



// Hook được tối ưu hoàn toàn cho TauriReactApp
export function useAssetBrowserModel() {
  const assetManager = AssetManager.getInstance();
  
  // 🔄 State quản lý toàn bộ trình duyệt asset
  const [assets, setAssets] = useState<Asset[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState<boolean>(false);
  const [renamingAssetId, setRenamingAssetId] = useState<string | null>(null);
  const [newAssetName, setNewAssetName] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState<boolean>(false);
  const [folderNameInput, setFolderNameInput] = useState<string>("");

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
  const selectAsset = (assetId: string) => {
    setSelectedAssetId(assetId);
    // Phát sự kiện cho các panel khác (giữ nguyên như cũ của TauriReactApp)
    window.dispatchEvent(new CustomEvent('assetSelected', { detail: { assetId } }));
  };

  const isAssetSelected = (assetId: string): boolean => selectedAssetId === assetId;

  // 📝 Đổi tên asset - gọi API AssetManager hiện có
  const renameAsset = async (assetId: string, name: string): Promise<boolean> => {
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
        
        // Không cần gọi emit() vì nó là private, sử dụng addAsset lại để trigger event
        const allAssets = assetManager.getAllAssets();
        setAssets(allAssets);
      }
      
      setIsRenaming(false);
      setRenamingAssetId(null);
      setNewAssetName("");
      return true;
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || "Không thể đổi tên asset");
      return false;
    }
  };

  // 🗑️ Xóa asset - gọi API AssetManager hiện có
  const deleteAsset = async (assetId: string): Promise<boolean> => {
    setErrorMessage(null);
    try {
      assetManager.removeAsset(assetId);
      if (selectedAssetId === assetId) setSelectedAssetId(null);
      return true;
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || "Không thể xóa asset");
      return false;
    }
  };

  // 🆕 Tạo thư mục mới - tương thích hệ thống Tauri file system
  const createNewFolder = async (): Promise<boolean> => {
    setErrorMessage(null);
    try {
      if (!folderNameInput.trim()) throw new Error("Tên thư mục không được để trống");
      
      // Trong môi trường Tauri, bạn có thể gọi API tauri::fs::create_dir ở đây
      // Ví dụ: await invoke('create_folder', { path: `${ASSETS_ROOT_FOLDER}/${folderNameInput}` });
      
      setFolderNameInput("");
      setShowCreateFolder(false);
      return true;
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || "Không thể tạo thư mục");
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
    startRename: (assetId: string) => {
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
    getAssetContentUrl: (asset: Asset) => asset.thumbnail || asset.path || '',
    
    // Helper lấy các mục trong thư mục
    getFolderEntries: (folderPath: string) => listFolderEntries(assets, folderPath),
  };
}