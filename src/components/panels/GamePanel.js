import { PixiApp } from '../../core/PixiApp.js';

export function createGamePanel(parent) {
    const container = document.createElement('div');
    container.id = 'game-canvas-container';
    parent.appendChild(container);

    // Khởi tạo PixiApp
    const pixiApp = new PixiApp(container);

    // Trả về instance để có thể truy xuất từ các panel khác (như Inspector)
    window.gameEditor.pixiApp = pixiApp;

    return {
        dispose: () => pixiApp.destroy()
    };
}