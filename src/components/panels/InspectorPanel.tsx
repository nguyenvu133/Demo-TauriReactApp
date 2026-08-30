import { useState, useEffect, useRef } from 'react';
import { Asset } from '../../core/Asset';
import { GameObject, GameScript } from '../../core/GameObject';

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

  const handlePropertyChange = (key: string, value: any) => {
    if (!selectedSceneObject || !objectProperties) return;
    
    const newProperties = { ...objectProperties, [key]: value };
    setObjectProperties(newProperties);

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

    (window as any).gameEditor?.emit('objectUpdated', selectedSceneObject);
  };

  const compileScript = (source: string, name: string): GameScript => {
    const scriptId = `script_${Date.now()}`;
    let start: ((gameObject: GameObject) => void) | undefined;
    let update: ((gameObject: GameObject, delta: number) => void) | undefined;
    let onDestroy: ((gameObject: GameObject) => void) | undefined;
    
    try {
      const exports: any = {};
      const moduleExports = exports;
      
      const ScriptRunner = new Function('module', 'exports', `
        ${source}
      `);
      
      ScriptRunner({ exports: moduleExports }, moduleExports);
      
      if (typeof moduleExports.start === 'function') start = moduleExports.start;
      if (typeof moduleExports.update === 'function') update = moduleExports.update;
      if (typeof moduleExports.onDestroy === 'function') onDestroy = moduleExports.onDestroy;
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

  const handleAddScript = () => {
    if (!selectedSceneObject || !newScriptName.trim()) return;
    
    const defaultScript = `// Script template: ${newScriptName}
export function start(gameObject) {
  console.log('Script started on:', gameObject.name);
}

export function update(gameObject, delta) {
  // gameObject.rotation += 0.01 * delta;
}

export function onDestroy(gameObject) {
  console.log('Script destroyed on:', gameObject.name);
}`;
    
    const newScript = compileScript(defaultScript, newScriptName);
    selectedSceneObject.addScript(newScript);
    
    setNewScriptName('');
    setShowAddScript(false);
    setObjectProperties({...objectProperties});
  };

  const handleEditScript = (script: GameScript) => {
    setEditingScript(script);
    setScriptSource(script.source);
  };

  const handleSaveScript = () => {
    if (!editingScript || !selectedSceneObject) return;
    
    const updatedScript = compileScript(scriptSource, editingScript.name);
    const index = selectedSceneObject.scripts.findIndex(s => s.id === editingScript.id);
    
    if (index !== -1) {
      selectedSceneObject.scripts[index] = updatedScript;
      setEditingScript(null);
      setScriptSource('');
    }
  };

  const handleToggleScript = (scriptId: string) => {
    if (!selectedSceneObject) return;
    const script = selectedSceneObject.scripts.find(s => s.id === scriptId);
    if (script) {
      script.isEnabled = !script.isEnabled;
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

  const handleRemoveScript = (scriptId: string) => {
    if (!selectedSceneObject) return;
    selectedSceneObject.removeScript(scriptId);
    setObjectProperties({...objectProperties});
  };

  useEffect(() => {
    if (editingScript && codeMirrorRef.current && !cmInstanceRef.current) {
      if (typeof CodeMirror !== 'undefined') {
        cmInstanceRef.current = CodeMirror(codeMirrorRef.current, {
          value: scriptSource,
          mode: 'javascript',
          theme: 'monokai',
          lineNumbers: true,
          indentUnit: 2,
          tabSize: 2,
          lineWrapping: true
        });

        cmInstanceRef.current.on('change', (cm: any) => {
          setScriptSource(cm.getValue());
        });

        cmInstanceRef.current.setSize('100%', '300px');
      }
    }

    return () => {
      if (cmInstanceRef.current) {
        cmInstanceRef.current.toTextArea?.();
        cmInstanceRef.current = null;
      }
    };
  }, [editingScript]);

  useEffect(() => {
    if (cmInstanceRef.current && cmInstanceRef.current.getValue() !== scriptSource) {
      cmInstanceRef.current.setValue(scriptSource);
    }
  }, [scriptSource]);

  useEffect(() => {
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

    window.addEventListener('objectSelected', (e: any) => handleObjectSelected(e.detail));
    window.addEventListener('assetSelected', (e: any) => handleAssetSelected(e.detail));
    (window as any).gameEditor?.on('objectSelected', handleObjectSelected);
    (window as any).gameEditor?.on('assetSelected', handleAssetSelected);

    return () => {
      (window as any).gameEditor?.off('objectSelected', handleObjectSelected);
      (window as any).gameEditor?.off('assetSelected', handleAssetSelected);
    };
  }, []);

  const renderPropertyField = (label: string, value: any, type: string = 'text', propertyKey?: string) => {
    return (
      <div className="flex items-center gap-2 py-1 border-b border-gray-800 text-xs">
        <label className="w-24 text-gray-400 shrink-0">{label}</label>
        {type === 'number' ? (
          <input
            type="number"
            value={value}
            onChange={(e) => propertyKey && handlePropertyChange(propertyKey, parseFloat(e.target.value) || 0)}
            className="flex-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-200 focus:outline-none focus:border-blue-500"
          />
        ) : type === 'color' ? (
          <input
            type="color"
            defaultValue={value}
            className="w-7 h-6 p-0 bg-gray-800 border border-gray-700 rounded cursor-pointer"
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
            className="flex-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-200 focus:outline-none focus:border-blue-500"
          />
        )}
      </div>
    );
  };

  if (!selectedAsset && !selectedSceneObject) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-950 text-gray-500 p-4">
        <div className="text-center">
          <div className="text-3xl mb-2">🔍</div>
          <p className="text-xs">Chọn một đối tượng hoặc tài nguyên để xem thuộc tính</p>
        </div>
      </div>
    );
  }

  if (selectedAsset) {
    return (
      <div className="w-full h-full overflow-y-auto bg-gray-950 text-white p-3">
        <div className="mb-3 pb-2 border-b border-gray-800">
          <div className="text-sm font-semibold text-gray-200 truncate">{selectedAsset.name}</div>
          <div className="text-[10px] text-gray-500">ID: {selectedAsset.id.slice(0, 20)}...</div>
        </div>

        {selectedAsset.thumbnail && (
          <div className="mb-3">
            <img 
              src={selectedAsset.thumbnail} 
              alt={selectedAsset.name}
              className="w-full rounded border border-gray-700 object-cover"
            />
          </div>
        )}

        <div className="mb-3">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
            📋 Thông tin chung
          </div>
          {renderPropertyField('Name', selectedAsset.name)}
          {renderPropertyField('Type', selectedAsset.type)}
          {renderPropertyField('Path', selectedAsset.path)}
          {renderPropertyField('Size', `${(selectedAsset.size / 1024).toFixed(1)} KB`)}
          {renderPropertyField('Status', selectedAsset.status)}
        </div>

        {Object.keys(selectedAsset.metadata || {}).length > 0 && (
          <div className="mb-3">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              ⚙️ Metadata
            </div>
            {Object.entries(selectedAsset.metadata).map(([key, value]) => (
              renderPropertyField(key, String(value))
            ))}
          </div>
        )}
      </div>
    );
  }

  if (selectedSceneObject) {
    return (
      <div className="w-full h-full overflow-y-auto bg-gray-950 text-white p-3">
        <div className="mb-3 pb-2 border-b border-gray-800">
          <div className="text-sm font-semibold text-gray-200">{selectedSceneObject.name}</div>
          <div className="text-[10px] text-gray-500">{selectedSceneObject.type}</div>
        </div>

        {/* Transform */}
        <div className="mb-3">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
            🔄 Transform
          </div>
          {renderPropertyField('Position X', Math.round(objectProperties?.x ?? 0), 'number', 'x')}
          {renderPropertyField('Position Y', Math.round(objectProperties?.y ?? 0), 'number', 'y')}
          {renderPropertyField('Rotation', Math.round((objectProperties?.rotation ?? 0) * 180 / Math.PI), 'number', 'rotation')}
          {renderPropertyField('Scale X', objectProperties?.scaleX ?? 1, 'number', 'scaleX')}
          {renderPropertyField('Scale Y', objectProperties?.scaleY ?? 1, 'number', 'scaleY')}
        </div>

        {/* Scripts */}
        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Scripts</h3>
            <button 
              onClick={() => setShowAddScript(true)}
              className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
            >
              + Add Script
            </button>
          </div>

          {showAddScript && (
            <div className="p-2.5 bg-gray-900 border border-gray-800 rounded mb-2">
              <input
                type="text"
                value={newScriptName}
                onChange={(e) => setNewScriptName(e.target.value)}
                placeholder="Tên script..."
                className="w-full px-2 py-1 bg-gray-800 text-white text-xs rounded mb-2 outline-none focus:border-blue-500 border border-gray-700"
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
                  className="flex-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {editingScript && (
            <div className="p-2.5 bg-gray-900 border border-gray-800 rounded mb-2">
              <h4 className="text-xs font-medium text-white mb-2">Edit: {editingScript.name}</h4>
              {typeof CodeMirror !== 'undefined' ? (
                <div ref={codeMirrorRef} className="mb-2 w-full text-xs" />
              ) : (
                <textarea
                  value={scriptSource}
                  onChange={(e) => setScriptSource(e.target.value)}
                  className="w-full h-40 px-2 py-1 bg-gray-800 text-green-400 text-xs font-mono rounded mb-2 outline-none focus:border-blue-500 border border-gray-700"
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
                  className="flex-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {selectedSceneObject?.scripts.length === 0 ? (
            <div className="p-2.5 bg-gray-900 border border-gray-800 rounded text-xs text-gray-500 text-center">
              Chưa có script nào được gắn
            </div>
          ) : (
            <div className="space-y-1.5">
              {selectedSceneObject?.scripts.map(script => (
                <div key={script.id} className="p-2 bg-gray-900 border border-gray-800 rounded flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      checked={script.isEnabled}
                      onChange={() => handleToggleScript(script.id)}
                      className="w-3.5 h-3.5 rounded"
                    />
                    <span className="text-xs text-gray-200">{script.name}</span>
                  </div>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => handleEditScript(script)}
                      className="px-1.5 py-0.5 bg-yellow-600 hover:bg-yellow-700 text-white text-[10px] rounded"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => handleRemoveScript(script.id)}
                      className="px-1.5 py-0.5 bg-red-600 hover:bg-red-700 text-white text-[10px] rounded"
                    >
                      Xóa
                    </button>
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
