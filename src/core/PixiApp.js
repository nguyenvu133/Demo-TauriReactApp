export class PixiApp {
    constructor(container, width = 800, height = 500) {
        this.container = container;
        this.width = width;
        this.height = height;
        this.app = null;
        this.gameObject = null;
        
        this.init();
    }

    init() {
        // Khởi tạo PixiJS Application
        this.app = new PIXI.Application({
            width: this.width,
            height: this.height,
            backgroundColor: 0x0f0f23,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true
        });

        this.container.appendChild(this.app.view);
        this.createDemoObject();
        this.startAnimation();
    }

    createDemoObject() {
        // Tạo hình chữ nhật demo
        this.gameObject = new PIXI.Graphics();
        this.gameObject.beginFill(0xe94560);
        this.gameObject.drawRect(0, 0, 150, 100);
        this.gameObject.endFill();
        this.gameObject.x = this.width / 2 - 75;
        this.gameObject.y = this.height / 2 - 50;
        this.gameObject.interactive = true;
        
        this.app.stage.addChild(this.gameObject);
    }

    startAnimation() {
        this.app.ticker.add((delta) => {
            if (this.gameObject) {
                this.gameObject.rotation += 0.01 * delta;
            }
        });
    }

    setPosition(x, y) {
        if (this.gameObject) {
            this.gameObject.x = x;
            this.gameObject.y = y;
        }
    }

    setRotation(rotation) {
        if (this.gameObject) {
            this.gameObject.rotation = rotation * (Math.PI / 180);
        }
    }

    setScale(scaleX, scaleY) {
        if (this.gameObject) {
            this.gameObject.scale.x = scaleX;
            this.gameObject.scale.y = scaleY;
        }
    }

    destroy() {
        if (this.app) {
            this.app.destroy();
        }
    }

    getGameObject() {
        return this.gameObject;
    }
}