import * as PIXI from 'pixi.js';

// Interface định nghĩa các property toàn cục thêm vào window
declare global {
  interface Window {
    pixiApp: PIXI.Application | null;
  }
}

export class PixiMVPDemo {
  private app: PIXI.Application | null = null;
  private shapes: PIXI.Graphics[] = [];
  private title: PIXI.Text | null = null;
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.init();
  }

  private init(): void {
    // Kiểm tra PIXI đã load thành công
    if (typeof PIXI === 'undefined') {
      console.error('❌ PIXI.js chưa được load!');
      return;
    }

    console.log('✅ PIXI.js loaded, khởi chạy MVP demo...');

    // Tạo canvas element cho PixiJS
    const canvas = document.createElement('canvas');
    canvas.id = 'pixi-mvp-demo';
    canvas.width = 800;
    canvas.height = 600;
    this.container.appendChild(canvas);

    // Khởi tạo ứng dụng PixiJS với cấu hình chuẩn
    this.app = new PIXI.Application({
      view: canvas,
      width: 800,
      height: 600,
      backgroundColor: 0x16213e,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true
    });

    // Lưu app vào window để dễ dàng debug
    window.pixiApp = this.app;

    // Tạo các elements UI và bắt đầu chạy
    this.createDemoInfo();
    this.createTitle();
    this.createInteractiveShapes();
    this.startAnimationLoop();

    console.log('🎉 PixiJS MVP Demo đã khởi chạy thành công!');
  }

  private createDemoInfo(): void {
    const infoDiv = document.createElement('div');
    infoDiv.className = 'demo-info';
    infoDiv.innerHTML = `
      <h1>🎮 PixiJS MVP Demo - Minimum Viable Product</h1>
      <p>Click vào các hình chữ nhật màu để di chuyển chúng | Xem animation cơ bản hoạt động</p>
    `;
    this.container.appendChild(infoDiv);
  }

  private createTitle(): void {
    if (!this.app) return;

    // Tạo text tiêu đề với style hiện đại
    this.title = new PIXI.Text('PixiJS MVP Demo', {
      fontFamily: 'Arial, sans-serif',
      fontSize: 36,
      fill: ['#00d4ff', '#ff006e'],
      fontWeight: 'bold',
      align: 'center'
    });
    
    this.title.x = this.app.screen.width / 2;
    this.title.y = 50;
    this.title.anchor.set(0.5);
    this.app.stage.addChild(this.title);
  }

  private createInteractiveShapes(): void {
    if (!this.app) return;

    // Mảng màu sắc cho các hình
    const colors: number[] = [0x00d4ff, 0xff006e, 0x06ffa5, 0xffbe0b, 0x8338ec];
    
    for (let i = 0; i < 5; i++) {
      const rect = new PIXI.Graphics();
      rect.beginFill(colors[i]);
      rect.drawRoundedRect(0, 0, 100, 100, 15);
      rect.endFill();
      
      // Vị trí ban đầu của các hình
      rect.x = 100 + (i % 3) * 200;
      rect.y = 150 + Math.floor(i / 3) * 180;
      // Bật tương tác cho graphics (cách đúng cho PIXI v7)
      rect.eventMode = 'static';
      rect.cursor = 'pointer';
      
      // Gắn event click
      rect.on('pointerdown', () => {
        this.handleShapeClick(rect);
      });
      
      this.app.stage.addChild(rect);
      this.shapes.push(rect);
    }
  }

  private handleShapeClick(rect: PIXI.Graphics): void {
    if (!this.app) return;

    // Hiệu ứng scale khi click
    rect.scale.set(1.2);
    rect.alpha = 0.8;
    
    // Di chuyển ngẫu nhiên trong phạm vi canvas
    rect.x += (Math.random() - 0.5) * 200;
    rect.y += (Math.random() - 0.5) * 150;
    
    // Giới hạn không để hình vượt ra ngoài màn hình
    rect.x = Math.max(50, Math.min(this.app.screen.width - 150, rect.x));
    rect.y = Math.max(120, Math.min(this.app.screen.height - 150, rect.y));
    
    // Reset trạng thái sau 200ms
    setTimeout(() => {
      rect.scale.set(1);
      rect.alpha = 1;
    }, 200);
  }

  private startAnimationLoop(): void {
    if (!this.app) return;

    // Animation loop sử dụng PixiJS ticker
    this.app.ticker.add(() => {
      this.shapes.forEach((shape: PIXI.Graphics, index: number) => {
        // Xoay ngược chiều nhau để tạo hiệu ứng đẹp
        shape.rotation += 0.005 * (index % 2 === 0 ? 1 : -1);
      });
      
      // Hiệu ứng lung linh cho tiêu đề
      if (this.title) {
        this.title.rotation = Math.sin(Date.now() * 0.001) * 0.05;
      }
    });
  }

  // Cleanup function: Hủy toàn bộ resource khi component unmount
  public destroy(): void {
    // Hủy PixiJS application
    if (this.app) {
      this.app.destroy(true, { children: true, texture: true, baseTexture: true });
      this.app = null;
      window.pixiApp = null;
    }

    // Xóa các DOM elements đã tạo
    const canvas = document.getElementById('pixi-mvp-demo');
    const info = document.querySelector('.demo-info');
    canvas?.remove();
    info?.remove();

    // Clear mảng shapes
    this.shapes = [];
    this.title = null;
  }
}

export default PixiMVPDemo;