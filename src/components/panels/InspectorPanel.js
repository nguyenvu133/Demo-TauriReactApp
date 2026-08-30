export function createInspectorPanel(parent) {
    const content = document.createElement('div');
    content.className = 'panel-content text-white text-sm';
    content.innerHTML = `
        <h3 class="font-bold mb-4 text-gray-300">Transform</h3>
        <div class="inspector-field">
            <label class="inspector-label">Position X</label>
            <input type="number" class="inspector-input" id="posX" value="325">
        </div>
        <div class="inspector-field">
            <label class="inspector-label">Position Y</label>
            <input type="number" class="inspector-input" id="posY" value="200">
        </div>
        <div class="inspector-field">
            <label class="inspector-label">Scale X</label>
            <input type="number" class="inspector-input" id="scaleX" value="1" step="0.1">
        </div>
        <div class="inspector-field">
            <label class="inspector-label">Scale Y</label>
            <input type="number" class="inspector-input" id="scaleY" value="1" step="0.1">
        </div>
        <div class="inspector-field">
            <label class="inspector-label">Rotation</label>
            <input type="number" class="inspector-input" id="rotation" value="0" step="1">
        </div>
    `;

    // Setup event listeners cho các input
    setupInspectorEvents(content);
    
    parent.appendChild(content);

    // Lắng nghe sự kiện node được chọn từ Hierarchy
    window.gameEditor.on('nodeSelected', (nodeName) => {
        updateInspectorValues(nodeName);
    });

    return { dispose: () => {} };
}

function setupInspectorEvents(container) {
    // Liên kết các input với PixiApp để cập nhật trực tiếp
    const posXInput = container.querySelector('#posX');
    const posYInput = container.querySelector('#posY');
    const scaleXInput = container.querySelector('#scaleX');
    const scaleYInput = container.querySelector('#scaleY');
    const rotationInput = container.querySelector('#rotation');

    // Xử lý thay đổi giá trị
    posXInput.addEventListener('change', (e) => {
        if (window.gameEditor.pixiApp) {
            window.gameEditor.pixiApp.setPosition(parseFloat(e.target.value), parseFloat(posYInput.value));
        }
    });

    posYInput.addEventListener('change', (e) => {
        if (window.gameEditor.pixiApp) {
            window.gameEditor.pixiApp.setPosition(parseFloat(posXInput.value), parseFloat(e.target.value));
        }
    });

    scaleXInput.addEventListener('change', (e) => {
        if (window.gameEditor.pixiApp) {
            window.gameEditor.pixiApp.setScale(parseFloat(e.target.value), parseFloat(scaleYInput.value));
        }
    });

    scaleYInput.addEventListener('change', (e) => {
        if (window.gameEditor.pixiApp) {
            window.gameEditor.pixiApp.setScale(parseFloat(scaleXInput.value), parseFloat(e.target.value));
        }
    });

    rotationInput.addEventListener('change', (e) => {
        if (window.gameEditor.pixiApp) {
            window.gameEditor.pixiApp.setRotation(parseFloat(e.target.value));
        }
    });
}

function updateInspectorValues(nodeName) {
    // Cập nhật giá trị trong inspector khi chọn node khác
    console.log(`[InspectorPanel] Updating values for: ${nodeName}`);
    // Ở đây có thể thêm logic lấy giá trị từ node thực tế
}