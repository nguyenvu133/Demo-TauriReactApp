import { DockviewManager } from './core/DockviewManager.js';
import { createGamePanel } from './components/panels/GamePanel.js';
import { createAssetsPanel } from './components/panels/AssetsPanel.js';
import { createHierarchyPanel } from './components/panels/HierarchyPanel.js';
import { createInspectorPanel } from './components/panels/InspectorPanel.js';
import { createConsolePanel } from './components/panels/ConsolePanel.js';

// Khởi tạo global game editor instance (giống như trong html5-game-editor-master)
window.gameEditor = {
    pixiApp: null,
    console: null,
    events: {},
    
    // Event system
    on(event, callback) {
        if (!this.events[event]) this.events[event] = [];
        this.events[event].push(callback);
    },
    
    emit(event, data) {
        if (this.events[event]) {
            this.events[event].forEach(callback => callback(data));
        }
    }
};

// Khởi tạo ứng dụng khi DOM đã sẵn sàng
document.addEventListener('DOMContentLoaded', initEditor);

function initEditor() {
    console.log('[Editor] Initializing Game Editor...');
    
    // Khởi tạo Dockview Manager
    const dockviewManager = new DockviewManager('app');
    
    // Đăng ký các component (panel) với dockview
    registerPanels(dockviewManager);
    
    console.log('[Editor] Game Editor initialized successfully!');
    window.gameEditor.console?.log('All panels loaded successfully');
}

function registerPanels(dockviewManager) {
    // Đăng ký từng panel với dockview
    dockviewManager.registerComponent('game', createGamePanel);
    dockviewManager.registerComponent('assets', createAssetsPanel);
    dockviewManager.registerComponent('hierarchy', createHierarchyPanel);
    dockviewManager.registerComponent('inspector', createInspectorPanel);
    dockviewManager.registerComponent('console', createConsolePanel);
    
    console.log('[Editor] All panels registered');
}

// Export cho các module khác nếu cần
export { window.gameEditor };