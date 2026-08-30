export class DockviewManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.dockview = null;
        this.panels = {};
        
        this.init();
    }

    init() {
        // Khởi tạo Dockview
        this.dockview = new dockview.DockviewComponent(this.container, {
            theme: 'dockview-theme-dark',
            disableFloatingGroups: false
        });

        this.setupPanels();
    }

    setupPanels() {
        // Panel chính - Game Canvas
        this.addPanel({
            id: 'game-canvas',
            component: 'game',
            title: 'Game View',
            width: 600,
            height: 400
        });

        // Panel Assets (bên trái)
        this.addPanel({
            id: 'assets',
            component: 'assets',
            title: 'Assets',
            width: 200,
            position: { referencePanel: 'game-canvas', direction: 'left' }
        });

        // Panel Hierarchy (bên trên Assets)
        this.addPanel({
            id: 'hierarchy',
            component: 'hierarchy',
            title: 'Hierarchy',
            height: 200,
            position: { referencePanel: 'assets', direction: 'top' }
        });

        // Panel Inspector (bên phải Game Canvas)
        this.addPanel({
            id: 'inspector',
            component: 'inspector',
            title: 'Inspector',
            width: 250,
            position: { referencePanel: 'game-canvas', direction: 'right' }
        });

        // Panel Console (bên dưới Game Canvas)
        this.addPanel({
            id: 'console',
            component: 'console',
            title: 'Console',
            height: 150,
            position: { referencePanel: 'game-canvas', direction: 'bottom' }
        });
    }

    addPanel(options) {
        const panel = this.dockview.addPanel(options);
        this.panels[options.id] = panel;
        return panel;
    }

    registerComponent(componentId, renderer) {
        this.dockview.addComponent(componentId, renderer);
    }

    getPanel(panelId) {
        return this.panels[panelId];
    }

    getDockview() {
        return this.dockview;
    }
}