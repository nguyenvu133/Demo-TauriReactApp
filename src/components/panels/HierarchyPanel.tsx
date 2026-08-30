import { useState, useEffect } from 'react';

interface SceneObject {
  id: string;
  name: string;
  type: string;
  children: SceneObject[];
  isExpanded?: boolean;
}

export function HierarchyPanel() {
  const [sceneObjects, setSceneObjects] = useState<SceneObject[]>([
    {
      id: 'root',
      name: 'Scene',
      type: 'scene',
      isExpanded: true,
      children: [
        {
          id: 'demo_rect_001',
          name: 'Demo Rectangle',
          type: 'rect',
          children: []
        },
        {
          id: 'camera_001',
          name: 'Main Camera',
          type: 'camera',
          children: []
        }
      ]
    }
  ]);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    // Lắng nghe sự kiện thêm object mới từ gameEditor
    window.gameEditor.on('objectAdded', (newObject: any) => {
      setSceneObjects(prev => {
        const root = { ...prev[0] };
        root.children = [...root.children, {
          id: newObject.id,
          name: newObject.name,
          type: newObject.type,
          children: []
        }];
        return [root];
      });
    });

    // Lắng nghe sự kiện xóa object
    window.gameEditor.on('objectRemoved', (objectId: string) => {
      setSceneObjects(prev => {
        const root = { ...prev[0] };
        root.children = root.children.filter(c => c.id !== objectId);
        return [root];
      });
    });
  }, []);

  const toggleExpand = (id: string) => {
    setSceneObjects(prev => {
      const updateObject = (obj: SceneObject): SceneObject => {
        if (obj.id === id) {
          return { ...obj, isExpanded: !obj.isExpanded };
        }
        if (obj.children) {
          return { ...obj, children: obj.children.map(updateObject) };
        }
        return obj;
      };
      return prev.map(updateObject);
    });
  };

  const handleSelect = (id: string) => {
    setSelectedId(id);
    // Phát sự kiện chọn object để Inspector cập nhật
    window.gameEditor.emit('objectSelected', id);
  };

  const renderTreeItem = (obj: SceneObject, depth: number = 0) => {
    const hasChildren = obj.children && obj.children.length > 0;
    const isSelected = selectedId === obj.id;

    return (
      <div key={obj.id}>
        <div
          className={`flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-gray-700 ${isSelected ? 'bg-blue-600' : ''}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => handleSelect(obj.id)}
        >
          {hasChildren ? (
            <button 
              onClick={(e) => { e.stopPropagation(); toggleExpand(obj.id); }}
              className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-white"
            >
              {obj.isExpanded ? '▼' : '▶'}
            </button>
          ) : (
            <span className="w-4"></span>
          )}
          <span className="text-xs">{getObjectIcon(obj.type)}</span>
          <span className="text-sm text-gray-200 ml-1">{obj.name}</span>
        </div>
        {hasChildren && obj.isExpanded && obj.children.map(child => renderTreeItem(child, depth + 1))}
      </div>
    );
  };

  const getObjectIcon = (type: string): string => {
    switch (type) {
      case 'scene': return '📁';
      case 'rect': return '⬜';
      case 'camera': return '📷';
      case 'sprite': return '🖼️';
      case 'text': return '📝';
      default: return '📦';
    }
  };

  return (
    <div className="w-full h-full bg-gray-900 text-white overflow-auto">
      <div className="p-2 border-b border-gray-700 flex items-center justify-between">
        <span className="text-sm font-medium">Hierarchy</span>
        <button className="w-6 h-6 flex items-center justify-center hover:bg-gray-700 rounded text-xs" title="Create Empty">
          ➕
        </button>
      </div>
      <div className="py-1">
        {sceneObjects.map(obj => renderTreeItem(obj))}
      </div>
    </div>
  );
}