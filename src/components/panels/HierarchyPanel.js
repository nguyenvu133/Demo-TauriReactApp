export function createHierarchyPanel(parent) {
    const content = document.createElement('div');
    content.className = 'panel-content text-white text-sm';
    content.innerHTML = `
        <h3 class="font-bold mb-3 text-gray-300">Scene Hierarchy</h3>
        <div class="hierarchy-item" data-node="MainScene">▶️ MainScene</div>
        <div class="hierarchy-item ml-4" data-node="Player">├─ Player</div>
        <div class="hierarchy-item ml-4" data-node="Enemy1">├─ Enemy1</div>
        <div class="hierarchy-item ml-4" data-node="Enemy2">├─ Enemy2</div>
        <div class="hierarchy-item ml-4" data-node="Background">└─ Background</div>
    `;

    // Thêm event listeners cho các node trong hierarchy
    setupHierarchyEvents(content);
    
    parent.appendChild(content);

    return { dispose: () => {} };
}

function setupHierarchyEvents(container) {
    const hierarchyItems = container.querySelectorAll('.hierarchy-item');
    hierarchyItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const nodeName = item.dataset.node;
            console.log(`[HierarchyPanel] Selected node: ${nodeName}`);
            
            // Bỏ chọn tất cả các item khác
            document.querySelectorAll('.hierarchy-item').forEach(el => {
                el.style.backgroundColor = '#16213e';
            });
            
            // Đánh dấu item đang chọn
            item.style.backgroundColor = '#e94560';
            
            // Cập nhật Inspector với thông tin của node được chọn
            updateInspectorForNode(nodeName);
        });
    });
}

function updateInspectorForNode(nodeName) {
    // Logic cập nhật inspector dựa trên node được chọn
    // có thể implement trong InspectorPanel
    window.gameEditor.emit('nodeSelected', nodeName);
}