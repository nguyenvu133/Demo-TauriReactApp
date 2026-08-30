export function createConsolePanel(parent) {
    const content = document.createElement('div');
    content.className = 'panel-content text-green-400 font-mono text-xs';
    content.id = 'console-content';
    
    // Logs ban đầu
    const initialLogs = [
        '[INFO] Editor initialized',
        '[INFO] Loaded 5 assets',
        '[INFO] PixiJS renderer started',
        '[LOG] MainScene loaded successfully'
    ];
    
    content.innerHTML = initialLogs.map(log => `<div>${log}</div>`).join('');
    parent.appendChild(content);

    // Lưu container để thêm log sau này
    window.gameEditor.console = {
        log: (message) => addLog(content, message),
        error: (message) => addLog(content, `[ERROR] ${message}`, '#ff6b6b'),
        warn: (message) => addLog(content, `[WARN] ${message}`, '#feca57')
    };

    return { dispose: () => {} };
}

function addLog(container, message, color = '#4ade80') {
    const logEntry = document.createElement('div');
    logEntry.textContent = message;
    logEntry.style.color = color;
    container.appendChild(logEntry);
    // Auto scroll to bottom
    container.scrollTop = container.scrollHeight;
}