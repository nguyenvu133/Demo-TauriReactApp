import { useState, useEffect, useRef } from 'react';
import { Asset } from '../../core/Asset';
import { GameObject, GameScript } from '../../core/GameObject';

// Type declaration cho CodeMirror (load qua CDN)
declare const CodeMirror: any;

export function InspectorPanel() {
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [selectedSceneObject, setSelectedSceneObject] = useState<GameObject | null>(null);
  const [objectProperties, setObjectProperties] = useState<any>(null);
  const [showAddScript, setShowAddScript] = useState(false);
  const [newScriptName, setNewScriptName] = useState('');
  const [editingScript, setEditingScript] = useState<GameScript | null>(null);
  const [scriptSource, setScriptSource] = useState('');
  const codeMirrorRef = useRef<any>(null);
  const cmInstanceRef = useRef<any>(null);

  // Cập nhật properties khi chọn đối tượng mới
  useEffect(() => {
    if (selectedSceneObject) {
      setObjectProperties({
        x: selectedSceneObject.position.x,
        y: selectedSceneObject.position.y,
        rotation: selectedSceneObject.rotation,
        scaleX: selectedSceneObject.scale.x,
        scaleY: selectedSceneObject.scale.y,
        alpha: selectedSceneObject.alpha,
        visible: selectedSceneObject.visible,
        name: selectedSceneObject.name,
        type: selectedSceneObject.type,
        id: selectedSceneObject.id
      });
    }
  }, [selectedSceneObject]);

  // Xử lý thay đổi thuộc tính
  const handlePropertyChange = (key: string, value: any) => {
    if (!selectedSceneObject || !objectProperties) return;
    
    // Cập nhật state local
    const newProperties = { ...objectProperties, [key]: value };
    setObjectProperties(newProperties);

    // Cập nhật vào GameObject
    switch (key) {
      case 'x':
        selectedSceneObject.position = { ...selectedSceneObject.position, x: value };
        break;
      case 'y':
        selectedSceneObject.position = { ...selectedSceneObject.position, y: value };
        break;
      case 'scaleX':
        selectedSceneObject.scale = { ...selectedSceneObject.scale, x: value };
        break;
      case 'scaleY':
        selectedSceneObject.scale = { ...selectedSceneObject.scale, y: value };
        break;
      case 'rotation':
        selectedSceneObject.rotation = value;
        break;
      case 'alpha':
        selectedSceneObject.alpha = value;
        break;
      case 'visible':
        selectedSceneObject.visible = value;
        break;
      case 'name':
        selectedSceneObject.name = value;
        break;
    }

    // Phát sự kiện cập nhật đối tượng
    (window as any).gameEditor?.emit('objectUpdated', selectedSceneObject);
  };

  // Hàm biên dịch và chạy script từ mã nguồn
  const compileScript = (source: string, name: string): GameScript => {
    const scriptId = `script_${Date.now()}`;
    let start: ((gameObject: GameObject) => void) | undefined;
    let update: ((gameObject: GameObject, delta: number) => void) | undefined;
    let onDestroy: ((gameObject: GameObject) => void) | undefined;
    
    try {
      // Tạo một object chứa các exports
      const exports: any = {};
      const moduleExports = exports;
      
      // Tạo function để chạy mã nguồn script, tương đồng với module ESM
      const ScriptRunner = new Function('module', 'exports', `
        ${source}
      `);
      
      // Chạy script để trích xuất các hàm
      ScriptRunner({ exports: moduleExports }, moduleExports);
      
      // Lấy các hàm lifecycle từ exports
      if (typeof moduleExports.start === 'function') {
        start = moduleExports.start;
      }
      if (typeof moduleExports.update === 'function') {
        update = moduleExports.update;
      }
      if (typeof moduleExports.onDestroy === 'function') {
        onDestroy = moduleExports.onDestroy;
      }
    } catch (e) {
      console.error(`Lỗi biên dịch script ${name}:`, e);
    }

    return {
      id: scriptId,
      name: name,
      source: source,
      isEnabled: true,
      start: start,
      update: update,
      onDestroy: onDestroy,
      instance: {}
    };
  };

  // Thêm script mới vào GameObject
  const handleAddScript = () => {
    if (!selectedSceneObject || !newScriptName.trim()) return;
    
    // Mã nguồn script mặc định
    const defaultScript = `// Script template: ${newScriptName}
// Các hàm lifecycle có sẵn:
// - start(): Chạy 1 lần khi script được thêm vào object
// - update(delta): Chạy mỗi frame
// - onDestroy(): Chạy khi script bị xóa

export function start(gameObject) {
  console.log('Script started on:', gameObject.name);
}

export function update(gameObject, delta) {
  // Ví dụ: xoay đối tượng mỗi frame
  // gameObject.rotation += 0.01 * delta;
}

export function onDestroy(gameObject) {
  console.log('Script destroyed on:', gameObject.name);
}`;
    
    const newScript = compileScript(defaultScript, newScriptName);
    selectedSceneObject.addScript(newScript);
    
    // Reset state
    setNewScriptName('');
    setShowAddScript(false);
    
    // Cập nhật lại UI
    setObjectProperties({...objectProperties});
  };

  // Mở editor để chỉnh sửa script
  const handleEditScript = (script: GameScript) => {
    setEditingScript(script);
    setScriptSource(script.source);
  };

  // Lưu thay đổi script
  const handleSaveScript = () => {
    if (!editingScript || !selectedSceneObject) return;
    
    // Cập nhật mã nguồn và biên dịch lại
    const updatedScript = compileScript(scriptSource, editingScript.name);
    const index = selectedSceneObject.scripts.findIndex(s => s.id === editingScript.id);
    
    if (index !== -1) {
      selectedSceneObject.scripts[index] = updatedScript;
      setEditingScript(null);
      setScriptSource('');
    }
  };

  // Toggle enable/disable script
  const handleToggleScript = (scriptId: string) => {
    if (!selectedSceneObject) return;
    const script = selectedSceneObject.scripts.find(s => s.id === scriptId);
    if (script) {
      script.isEnabled = !script.isEnabled;
      // Nếu bật lại script thì gọi hàm start
      if (script.isEnabled && script.start) {
        try {
          script.start(selectedSceneObject);
        } catch (e) {
          console.error(`Lỗi trong script ${script.name}:`, e);
        }
      }
      setObjectProperties({...objectProperties});
    }
  };

  // Xóa script khỏi GameObject
  const handleRemoveScript = (scriptId: string) => {
    if (!selectedSceneObject) return;
    selectedSceneObject.removeScript(scriptId);
    setObjectProperties({...objectProperties});
  };

  // Khởi tạo CodeMirror khi mở editor script
  useEffect(() => {
    if (editingScript && codeMirrorRef.current && !cmInstanceRef.current) {
      // Kiểm tra CodeMirror đã load xong chưa
      if (typeof CodeMirror !== 'undefined') {
        // Khởi tạo CodeMirror với theme monokai, mode javascript
        cmInstanceRef.current = CodeMirror(codeMirrorRef.current, {
          value: scriptSource,
          mode: 'javascript',
          theme: 'monokai',
          lineNumbers: true,
          indentUnit: 2,
          tabSize: 2,
          lineWrapping: true
        });

        // Lắng nghe thay đổi trong editor
        cmInstanceRef.current.on('change', (cm: any) => {
          setScriptSource(cm.getValue());
        });

        // Đặt kích thước cho editor
        cmInstanceRef.current.setSize('100%', '300px');
      } else {
        // Fallback: dùng textarea nếu CodeMirror chưa load xong
        console.warn('CodeMirror chưa load xong, dùng textarea thay thế');
      }
    }

    // Hủy CodeMirror khi đóng editor
    return () => {
      if (cmInstanceRef.current) {
        cmInstanceRef.current.toTextArea();
        cmInstanceRef.current = null;
      }
    };
  }, [editingScript]);

  // Cập nhật nội dung editor khi scriptSource thay đổi
  useEffect(() => {
    if (cmInstanceRef.current && cmInstanceRef.current.getValue() !== scriptSource) {
      cmInstanceRef.current.setValue(scriptSource);
    }
  }, [scriptSource]);

  useEffect(() => {
    // Lắng nghe sự kiện chọn đối tượng từ game editor
    const handleObjectSelected = (object: any) => {
      if (object && 'id' in object && 'type' in object) {
        setSelectedSceneObject(object as GameObject);
      } else {
        setSelectedSceneObject(null);
      }
      setSelectedAsset(null);
    };

    const handleAssetSelected = (asset: Asset) => {
      setSelectedAsset(asset);
      setSelectedSceneObject(null);
    };

    // Thêm các lắng nghe sự kiện global
    (window as any).gameEditor?.on('objectSelected', handleObjectSelected);
    (window as any).gameEditor?.on('assetSelected', handleAssetSelected);

    return () => {
      (window as any).gameEditor?.off('objectSelected', handleObjectSelected);
      (window as any).gameEditor?.off('assetSelected', handleAssetSelected);
    };
  }, []);

  // Render các trường input cho thuộc tính
  const renderPropertyField = (label: string, value: any, type: string = 'text', propertyKey?: string) => {
    return (
      <div className="flex items-center gap-2 py-1.5 border-b border-gray-800">
        <label className="w-28 text-xs text-gray-400 shrink-0">{label}</label>
        {type === 'number' ? (
          <input
            type="number"
            value={value}
            onChange={(e) => propertyKey && handlePropertyChange(propertyKey, parseFloat(e.target.value))}
            className="flex-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm text-gray-300 focus:outline-none focus:border-blue-500"
          />
        ) : type === 'color' ? (
          <input
            type="color"
            defaultValue={value}
            className="w-8 h-6 p-0 bg-gray-800 border border-gray-700 rounded cursor-pointer"
          />
        ) : type === 'checkbox' ? (
          <input
            type="checkbox"
            checked={value}
            onChange={(e) => propertyKey && handlePropertyChange(propertyKey, e.target.checked)}
            className="w-4 h-4 accent-blue-500"
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => propertyKey && handlePropertyChange(propertyKey, e.target.value)}
            className="flex-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm text-gray-300 focus:outline-none focus:border-blue-500"
          />
        )}
      </div>
    );
  };

  // Nếu không có gì được chọn
  if (!selectedAsset && !selectedSceneObject) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900 text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-2">🔍</div>
          <p>Chọn một đối tượng hoặc tài nguyên để xem/thay đổi thuộc tính</p>
        </div>
      </div>
    );
  }

  // Hiển thị thông tin asset
  if (selectedAsset) {
    return (
      <div className="w-full h-full overflow-y-auto bg-gray-900 text-white p-3">
        {/* Header */}
        <div className="mb-4 pb-3 border-b border-gray-800">
          <div className="text-lg font-semibold text-gray-200 mb-1">{selectedAsset.name}</div>
          <div className="text-xs text-gray-500">ID: {selectedAsset.id.slice(0, 20)}...</div>
        </div>

        {/* Thumbnail nếu có */}
        {selectedAsset.thumbnail && (
          <div className="mb-4">
            <img 
              src={selectedAsset.thumbnail} 
              alt={selectedAsset.name}
              className="w-full rounded-lg border border-gray-700"
            />
          </div>
        )}

        {/* General section */}
        <div className="mb-4">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            📋 Thông tin chung
          </div>
          {renderPropertyField('Name', selectedAsset.name)}
          {renderPropertyField('Type', selectedAsset.type)}
          {renderPropertyField('Path', selectedAsset.path)}
          {renderPropertyField('Size', `${(selectedAsset.size / 1024).toFixed(1)} KB`)}
          {renderPropertyField('Status', selectedAsset.status)}
        </div>

        {/* Metadata section */}
        {Object.keys(selectedAsset.metadata).length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              ⚙️ Metadata
            </div>
            {Object.entries(selectedAsset.metadata).map(([key, value]) => (
              renderPropertyField(key, String(value))
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 pt-4 border-t border-gray-800 flex gap-2">
          <button 
            onClick={() => {
              // Mở file bằng ứng dụng mặc định
              console.log('Open asset:', selectedAsset.path);
            }}
            className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium transition-colors"
          >
            Mở
          </button>
          <button 
            onClick={() => {
              // Xóa asset
              console.log('Delete asset:', selectedAsset.id);
            }}
            className="px-3 py-2 bg-red-600 hover:bg-red-500 rounded text-sm font-medium transition-colors"
          >
            Xóa
          </button>
        </div>
      </div>
    );
  }

  // Hiển thị thông tin đối tượng trong scene (GameObject)
  if (selectedSceneObject) {
    return (
      <div className="w-full h-full overflow-y-auto bg-gray-900 text-white p-3">
        <div className="mb-4 pb-3 border-b border-gray-800">
          <div className="text-lg font-semibold text-gray-200 mb-1">{selectedSceneObject.name}</div>
          <div className="text-xs text-gray-500">{selectedSceneObject.type}</div>
        </div>

        {/* Transform section */}
        <div className="mb-4">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            🔄 Transform
          </div>
          {renderPropertyField('Position X', objectProperties?.x ?? 0, 'number', 'x')}
          {renderPropertyField('Position Y', objectProperties?.y ?? 0, 'number', 'y')}
          {renderPropertyField('Rotation', (objectProperties?.rotation ?? 0) * 180 / Math.PI, 'number', 'rotation')}
          {renderPropertyField('Scale X', objectProperties?.scaleX ?? 1, 'number', 'scaleX')}
          {renderPropertyField('Scale Y', objectProperties?.scaleY ?? 1, 'number', 'scaleY')}
        </div>

        {/* Kiểm tra nếu là sprite thì hiển thị thuộc tính đặc thù */}
        {('sprite' in selectedSceneObject || (selectedSceneObject as any).pixiObject?.texture) && (
          <div className="mb-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              🖼️ Sprite
            </div>
            <div className="mb-4 p-3 bg-gray-800 rounded">
              <h3 className="font-semibold text-gray-300 mb-2">Sprite Preview</h3>
              {(selectedSceneObject as any).pixiObject?.texture?.source?.url && (
                <img src={(selectedSceneObject as any).pixiObject.texture.source.url} alt="Texture" className="max-w-full rounded" />
              )}
            </div>
            {renderPropertyField('Tint', (selectedSceneObject as any).tint || '#ffffff', 'color')}
            {renderPropertyField('Alpha', objectProperties?.alpha ?? 1, 'number', 'alpha')}
            {renderPropertyField('Visible', objectProperties?.visible ?? true, 'checkbox', 'visible')}
          </div>
        )}

        <div className="mt-6">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Events</h3>
          <div className="p-3 bg-gray-800 rounded text-xs text-gray-400">
            {selectedSceneObject?.id && `GameObject ID: ${selectedSceneObject.id}`}
          </div>
        </div>

        {/* Phần quản lý Scripts */}
        <div className="mt-6">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Scripts</h3>
            <button 
              onClick={() => setShowAddScript(true)}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
            >
              + Add Script
            </button>
          </div>

          {/* Form thêm script mới */}
          {showAddScript && (
            <div className="p-3 bg-gray-800 rounded mb-2">
              <input
                type="text"
                value={newScriptName}
                onChange={(e) => setNewScriptName(e.target.value)}
                placeholder="Tên script..."
                className="w-full px-2 py-1 bg-gray-700 text-white text-sm rounded mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <button 
                  onClick={handleAddScript}
                  className="flex-1 px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded"
                >
                  Add
                </button>
                <button 
                  onClick={() => setShowAddScript(false)}
                  className="flex-1 px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Editor script */}
          {editingScript && (
            <div className="p-3 bg-gray-800 rounded mb-2">
              <h4 className="text-sm font-medium text-white mb-2">Edit: {editingScript.name}</h4>
              {/* Hiển thị CodeMirror hoặc textarea fallback */}
              {typeof CodeMirror !== 'undefined' ? (
                <div ref={codeMirrorRef} className="mb-2 w-full" />
              ) : (
                <textarea
                  value={scriptSource}
                  onChange={(e) => setScriptSource(e.target.value)}
                  className="w-full h-48 px-2 py-1 bg-gray-700 text-green-400 text-sm font-mono rounded mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
              <div className="flex gap-2">
                <button 
                  onClick={handleSaveScript}
                  className="flex-1 px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded"
                >
                  Save
                </button>
                <button 
                  onClick={() => { setEditingScript(null); setScriptSource(''); }}
                  className="flex-1 px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Danh sách script đã gắn vào object */}
          {selectedSceneObject?.scripts.length === 0 ? (
            <div className="p-3 bg-gray-800 rounded text-xs text-gray-400">
              Chưa có script nào được gắn vào đối tượng này
            </div>
          ) : (
            <div className="space-y-2">
              {selectedSceneObject?.scripts.map(script => (
                <div key={script.id} className="p-3 bg-gray-800 rounded">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-white">{script.name}</span>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => handleEditScript(script)}
                        className="px-2 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleRemoveScript(script.id)}
                        className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={script.isEnabled}
                        onChange={() => handleToggleScript(script.id)}
                        className="w-3 h-3 rounded"
                      />
                      {script.isEnabled ? 'Enabled' : 'Disabled'}
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

export default InspectorPanel;