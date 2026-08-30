export function createAssetsPanel(parent) {
    const content = document.createElement('div');
    content.className = 'panel-content text-white text-sm';
    content.innerHTML = `
        <h3 class="font-bold mb-3 text-gray-300">Project Assets</h3>
        <div class="asset-item" data-asset="player.png">📄 player.png</div>
        <div class="asset-item" data-asset="background.mp3">🎵 background.mp3</div>
        <div class="asset-item" data-asset="tileset.json">🗺️ tileset.json</div>
        <div class="asset-item" data-asset="level1.scene">📦 level1.scene</div>
        <div class="asset-item" data-asset="enemy.png">💀 enemy.png</div>
    `;

    // Thêm event listeners cho các asset
    setupAssetEvents(content);
    
    parent.appendChild(content);

    return { dispose: () => {} };
}

function setupAssetEvents(container) {
    const assetItems = container.querySelectorAll('.asset-item');
    assetItems.forEach(item => {
        item.addEventListener('click', () => {
            const assetName = item.dataset.asset;
            console.log(`[AssetsPanel] Selected asset: ${assetName}`);
            // Ở đây có thể thêm logic chọn asset, hiển thị preview...
        });
    });
}