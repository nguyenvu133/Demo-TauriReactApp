import { useEffect, useMemo, useState } from "react";
import { AssetManager } from "../core/AssetManager.ts";
// Import type cho interface Asset (chá»‰ dÃ¹ng cho TypeScript kiá»ƒm tra kiá»ƒu)
import type { Asset } from "../core/Asset.ts";

// Cáº¥u hÃ¬nh thÆ° má»¥c gá»‘c assets - tÆ°Æ¡ng thÃ­ch vá»›i cáº¥u trÃºc TauriReactApp hiá»‡n cÃ³
const ASSETS_ROOT_FOLDER = "/assets";

// ðŸ› ï¸ HÃ m trá»£ giÃºp Ä‘Æ¡n giáº£n hÃ³a phÃ¹ há»£p Tauri
const filterAssetsByQuery = (assets: Asset[], query: string): Asset[] => {
  if (!query.trim()) return assets;
  const lowerQuery = query.toLowerCase();
  return assets.filter(asset => asset.name.toLowerCase().includes(lowerQuery));
};

// Liá»‡t kÃª táº¥t cáº£ assets trong má»™t thÆ° má»¥c - tÆ°Æ¡ng thÃ­ch vá»›i asset.path hiá»‡n cÃ³
const listFolderEntries = (assets: Asset[], folderPath: string): Asset[] => {
  return assets.filter(asset => {
    if (folderPath === ASSETS_ROOT_FOLDER) {
      // Kiá»ƒm tra asset náº±m trá»±c tiáº¿p trong thÆ° má»¥c gá»‘c
      const lastSlashIndex = asset.path.lastIndexOf('/');
      const isInRoot = lastSlashIndex === folderPath.length - 1; // /assets chá»‰ cÃ³ 6 kÃ½ tá»±
      return isInRoot;
    }
    return asset.path.startsWith(folderPath + '/') && 
           !asset.path.substring(folderPath.length + 1).includes('/');
  });
};



// Hook Ä‘Æ°á»£c tá»‘i Æ°u hoÃ n toÃ n cho TauriReactApp
export function useAssetBrowserModel() {
  const assetManager = AssetManager.getInstance();
  
  // ðŸ”„ State quáº£n lÃ½ toÃ n bá»™ trÃ¬nh duyá»‡t asset
  const [assets, setAssets] = useState<Asset[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState<boolean>(false);
  const [renamingAssetId, setRenamingAssetId] = useState<string | null>(null);
  const [newAssetName, setNewAssetName] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState<boolean>(false);
  const [folderNameInput, setFolderNameInput] = useState<string>("");

  // ðŸŽ§ Láº¯ng nghe thay Ä‘á»•i tá»« AssetManager (tÆ°Æ¡ng thÃ­ch Tauri API)
  useEffect(() => {
    const updateAssetsList = () => {
      const allAssets = assetManager.getAllAssets();
      setAssets(allAssets);
    };

    // Láº§n Ä‘áº§u táº£i danh sÃ¡ch assets
    updateAssetsList();

    // ÄÄƒng kÃ½ láº¯ng nghe sá»± kiá»‡n cá»§a AssetManager hiá»‡n cÃ³
    assetManager.on('assetAdded', updateAssetsList);
    assetManager.on('assetRemoved', updateAssetsList);
    assetManager.on('assetLoaded', updateAssetsList);

    // Cleanup khi unmount (quan trá»ng vá»›i Tauri SPA)
    return () => {
      assetManager.off('assetAdded', updateAssetsList);
      assetManager.off('assetRemoved', updateAssetsList);
      assetManager.off('assetLoaded', updateAssetsList);
    };
  }, [assetManager]);

  // âœ… Tráº¡ng thÃ¡i tÃ¬m kiáº¿m
  const isSearching = searchQuery.trim().length > 0;

  // ðŸ“Š CÃ¡c assets Ä‘Æ°á»£c lá»c
  const filteredAssets = useMemo(() => {
    return filterAssetsByQuery(assets, searchQuery);
  }, [assets, searchQuery]);

  // ðŸ“ CÃ¡c assets trong thÆ° má»¥c gá»‘c
  const rootAssets = useMemo(() => {
    return listFolderEntries(assets, ASSETS_ROOT_FOLDER);
  }, [assets]);

  // ðŸ‘‡ CÃ¡c phÆ°Æ¡ng thá»©c tÆ°Æ¡ng tÃ¡c vá»›i assets (tÆ°Æ¡ng thÃ­ch AssetManager hiá»‡n cÃ³)
  const selectAsset = (assetId: string) => {
    setSelectedAssetId(assetId);
    // PhÃ¡t sá»± kiá»‡n cho cÃ¡c panel khÃ¡c (giá»¯ nguyÃªn nhÆ° cÅ© cá»§a TauriReactApp)
    window.dispatchEvent(new CustomEvent('assetSelected', { detail: { assetId } }));
  };

  const isAssetSelected = (assetId: string): boolean => selectedAssetId === assetId;

  // ðŸ“ Äá»•i tÃªn asset - gá»i API AssetManager hiá»‡n cÃ³
  const renameAsset = async (assetId: string, name: string): Promise<boolean> => {
    setErrorMessage(null);
    try {
      if (!name.trim()) throw new Error("TÃªn asset khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng");
      
      const asset = assetManager.getAsset(assetId);
      if (asset) {
        // Láº¥y Ä‘Æ°á»ng dáº«n cÅ©
        const oldPath = asset.path;
        const lastSlashIndex = oldPath.lastIndexOf('/');
        const folderPath = oldPath.substring(0, lastSlashIndex);
        // Táº¡o Ä‘Æ°á»ng dáº«n má»›i vá»›i tÃªn má»›i
        const newPath = `${folderPath}/${name.trim()}`;
        
        // Cáº­p nháº­t asset (asset lÃ  object reference nÃªn cáº­p nháº­t trá»±c tiáº¿p)
        asset.name = name.trim();
        asset.path = newPath;
        asset.modifiedAt = new Date();
        
        // KhÃ´ng cáº§n gá»i emit() vÃ¬ nÃ³ lÃ  private, sá»­ dá»¥ng addAsset láº¡i Ä‘á»ƒ trigger event
        const allAssets = assetManager.getAllAssets();
        setAssets(allAssets);
      }
      
      setIsRenaming(false);
      setRenamingAssetId(null);
      setNewAssetName("");
      return true;
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || "KhÃ´ng thá»ƒ Ä‘á»•i tÃªn asset");
      return false;
    }
  };

  // ðŸ—‘ï¸ XÃ³a asset - gá»i API AssetManager hiá»‡n cÃ³
  const deleteAsset = async (assetId: string): Promise<boolean> => {
    setErrorMessage(null);
    try {
      assetManager.removeAsset(assetId);
      if (selectedAssetId === assetId) setSelectedAssetId(null);
      return true;
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || "KhÃ´ng thá»ƒ xÃ³a asset");
      return false;
    }
  };

  // ðŸ†• Táº¡o thÆ° má»¥c má»›i - tÆ°Æ¡ng thÃ­ch há»‡ thá»‘ng Tauri file system
  const createNewFolder = async (): Promise<boolean> => {
    setErrorMessage(null);
    try {
      if (!folderNameInput.trim()) throw new Error("TÃªn thÆ° má»¥c khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng");
      
      // Trong mÃ´i trÆ°á»ng Tauri, báº¡n cÃ³ thá»ƒ gá»i API tauri::fs::create_dir á»Ÿ Ä‘Ã¢y
      // VÃ­ dá»¥: await invoke('create_folder', { path: `${ASSETS_ROOT_FOLDER}/${folderNameInput}` });
      
      setFolderNameInput("");
      setShowCreateFolder(false);
      return true;
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || "KhÃ´ng thá»ƒ táº¡o thÆ° má»¥c");
      return false;
    }
  };

  // ðŸ“‹ Tráº£ vá» táº¥t cáº£ state vÃ  method cho component sá»­ dá»¥ng
  return {
    // Danh sÃ¡ch assets
    assets,
    rootAssets,
    filteredAssets,
    isSearching,
    searchQuery,
    setSearchQuery,
    
    // State chá»n asset
    selectedAssetId,
    selectAsset,
    isAssetSelected,
    
    // State Ä‘á»•i tÃªn
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
    
    // State xÃ³a
    deleteAsset,
    
    // State táº¡o thÆ° má»¥c
    showCreateFolder,
    setShowCreateFolder,
    folderNameInput,
    setFolderNameInput,
    createNewFolder,
    
    // ThÃ´ng bÃ¡o lá»—i
    errorMessage,
    clearError: () => setErrorMessage(null),
    
    // Helper láº¥y Ä‘Æ°á»ng dáº«n asset
    getAssetContentUrl: (asset: Asset) => asset.thumbnail || asset.path || '',
    
    // Helper láº¥y cÃ¡c má»¥c trong thÆ° má»¥c
    getFolderEntries: (folderPath: string) => listFolderEntries(assets, folderPath),
  };
}
