/**
 * Photoroom Integration - Advanced Background & Shadow Removal Tool
 * Thư viện tích hợp thuật toán thông minh để tách đối tượng, xóa nền và xử lý bóng
 * Dựa trên các thuật toán Computer Vision hiện đại: GrabCut, K-means, Edge Detection, Shadow Matting
 */

class PhotoRoomIntegration {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.imageData = null;
        this.width = 0;
        this.height = 0;
        this.worker = null;
        this.workerAvailable = typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined';
        
        // Cấu hình thuật toán
        this.config = {
            // Xử lý thông minh
            smartProcessing: {
                enableDownscaling: true,
                maxProcessingSize: 800,
                useWebWorker: true
            },
            // Thuật toán GrabCut
            grabCut: {
                iterations: 5,
                gamma: 10,
            },
            // Phát hiện bóng
            shadowDetection: {
                threshold: 0.3,
                blurRadius: 5,
                minShadowArea: 100,
            },
            // Làm mịn cạnh
            edgeSmoothing: {
                featherRadius: 2,
                alphaSmoothing: true,
            },
            // Xử lý màu sắc
            colorCorrection: {
                autoWhiteBalance: true,
                contrastEnhancement: true,
            }
        };
        
        // Khởi tạo WebWorker nếu hỗ trợ
        if(this.workerAvailable && this.config.smartProcessing.useWebWorker) {
            this.initWorker();
        }
    }
    
    /**
     * 🚀 KHỞI TẠO WEBWORKER - XỬ LÝ NỀN GIÚP MAIN THREAD KHÔNG BỊ BLOCK
     */
    initWorker() {
        try {
            this.worker = new Worker('js/photoroom-worker.js');
            console.log('✅ WebWorker đã khởi tạo thành công - xử lý nền tách nền');
        } catch(e) {
            console.warn('⚠️ WebWorker không được hỗ trợ, sẽ xử lý trên main thread', e);
            this.workerAvailable = false;
        }
    }
    
    /**
     * 📐 SMART DOWNSCALING - THU NHỎ ẢNH TRƯỚC KHI XỬ LÝ ĐỂ TĂNG TỐC
     * Nếu ảnh > 800px, thu nhỏ để xử lý nhanh hơn 4x, sau đó upscale lại
     */
    async smartDownscale(imageBitmap) {
        const maxSize = this.config.smartProcessing.maxProcessingSize;
        let { width, height } = imageBitmap;
        let scale = 1;
        
        if(width > maxSize || height > maxSize) {
            scale = width > height ? maxSize / width : maxSize / height;
            const newW = Math.round(width * scale);
            const newH = Math.round(height * scale);
            
            console.log(`📐 Tự động thu nhỏ ảnh ${width}x${height} → ${newW}x${newH} để xử lý nhanh hơn`);
            
            const offcanvas = new OffscreenCanvas(newW, newH);
            const ctx = offcanvas.getContext('2d');
            ctx.drawImage(imageBitmap, 0, 0, newW, newH);
            
            // Giải phóng bitmap cũ
            imageBitmap.close();
            
            return { 
                canvas: offcanvas, 
                originalWidth: width, 
                originalHeight: height,
                scale: scale 
            };
        }
        
        const offcanvas = new OffscreenCanvas(width, height);
        const ctx = offcanvas.getContext('2d');
        ctx.drawImage(imageBitmap, 0, 0);
        imageBitmap.close();
        
        return { canvas: offcanvas, originalWidth: width, originalHeight: height, scale: 1 };
    }
    
    /**
     * 🔄 UPSCALE QUAY LẠI KÍCH THƯỚC GỐC SAU KHI XỬ LÝ XONG
     */
    upscaleToOriginal(processedCanvas, originalW, originalH) {
        const finalCanvas = new OffscreenCanvas(originalW, originalH);
        const ctx = finalCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(processedCanvas, 0, 0, originalW, originalH);
        return finalCanvas;
    }

    /**
     * Khởi tạo canvas và xử lý ảnh đầu vào
     * @param {HTMLImageElement|string} image - Ảnh đầu vào (có thể là element hoặc URL)
     * @returns {Promise<HTMLCanvasElement>} - Canvas đã xử lý
     */
    async processImage(image) {
        const startTime = performance.now();
        console.log('🚀 Bắt đầu xử lý ảnh với Photoroom AI...');
        
        // Tạo imageBitmap để xử lý GPU tăng tốc
        let imageBitmap;
        try {
            const img = typeof image === 'string' ? new Image() : image;
            if (typeof image === 'string') {
                img.crossOrigin = 'anonymous';
                const loadPromise = new Promise((resolve) => { img.onload = resolve; });
                img.src = image;
                await loadPromise;
            }
            imageBitmap = await createImageBitmap(img);
        } catch(e) {
            console.warn('⚠️ createImageBitmap không được hỗ trợ, dùng phương pháp cũ');
            return this.fallbackProcessImage(image);
        }
        
        // 🔄 Kiểm tra nếu có thể dùng WebWorker
        if(this.worker && this.config.smartProcessing.useWebWorker) {
            return this.processWithWorker(imageBitmap, startTime);
        }
        
        // Xử lý chính với smart downscaling
        const { canvas: smallCanvas, originalWidth, originalHeight } = await this.smartDownscale(imageBitmap);
        
        // Cập nhật kích thước xử lý
        this.canvas = smallCanvas;
        this.ctx = this.canvas.getContext('2d');
        this.imageData = this.ctx.getImageData(0, 0, smallCanvas.width, smallCanvas.height);
        this.width = smallCanvas.width;
        this.height = smallCanvas.height;
        
        console.log(`📊 Kích thước xử lý: ${this.width}x${this.height} pixels (gốc: ${originalWidth}x${originalHeight})`);
        
        // Thực hiện pipeline xử lý
        await this.executeProcessingPipeline();
        
        // Upscale về kích thước gốc
        const finalCanvas = this.upscaleToOriginal(this.canvas, originalWidth, originalHeight);
        
        const processingTime = (performance.now() - startTime).toFixed(2);
        console.log(`✅ Xử lý hoàn tất! Tổng thời gian: ${processingTime}ms`);
        
        return finalCanvas;
    }
    
    /**
     * 🚀 XỬ LÝ BẰNG WEBWORKER - MAIN THREAD KHÔNG BỊ BLOCK
     */
    async processWithWorker(imageBitmap, startTime) {
        return new Promise((resolve, reject) => {
            const taskId = Date.now() + Math.random();
            
            // Smart downscaling trước khi gửi sang worker
            this.smartDownscale(imageBitmap).then(({ canvas, originalWidth, originalHeight, scale }) => {
                const ctx = canvas.getContext('2d');
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                
                // Lắng nghe kết quả từ worker
                this.worker.onmessage = (e) => {
                    if(e.data.taskId === taskId) {
                        if(e.data.type === 'done') {
                            // Nhận kết quả và upscale về kích thước gốc
                            const finalCanvas = document.createElement('canvas');
                            finalCanvas.width = e.data.width;
                            finalCanvas.height = e.data.height;
                            const finalCtx = finalCanvas.getContext('2d');
                            finalCtx.putImageData(e.data.imageData, 0, 0);
                            
                            // Upscale về kích thước gốc nếu cần
                            const upscaledCanvas = scale < 1 ? this.upscaleToOriginal(finalCanvas, originalWidth, originalHeight) : finalCanvas;
                            
                            const processingTime = (performance.now() - startTime).toFixed(2);
                            console.log(`✅ WebWorker xử lý hoàn tất! Thời gian: ${processingTime}ms`);
                            resolve(upscaledCanvas);
                        } else if(e.data.type === 'error') {
                            console.error('❌ Worker error:', e.data.error);
                            reject(new Error(e.data.error));
                        }
                    }
                };
                
                // Gửi dữ liệu sang worker để xử lý
                this.worker.postMessage({
                    type: 'process',
                    imageData: imageData,
                    width: canvas.width,
                    height: canvas.height,
                    config: this.config,
                    taskId: taskId
                }, [imageData.data.buffer]);
            }).catch(reject);
        });
    }
    
    /**
   * ⚡ PIPELINE XỬ LÝ CHÍNH - GỌI TỪ CẢ MAIN THREAD VÀ WORKER
   * Chứa tất cả các thuật toán xử lý: tiền xử lý, phát hiện bóng, GrabCut, làm mịn
   */
  async executeProcessingPipeline() {
    // 1. Tiền xử lý ảnh (Giảm nhiễu + Tăng cường độ tương phản)
    this.applyGaussianBlur(2);
    if(this.config.colorCorrection.contrastEnhancement) {
      this.applyCLAHE(); // Adaptive histogram equalization
    }
    if(this.config.colorCorrection.autoWhiteBalance) {
      this.autoWhiteBalance();
    }
    
    // 2. Phát hiện và xóa bóng
    this.detectAndRemoveShadows();
    
    // 3. Thuật toán GrabCut tách nền
    this.runGrabCut();
    
    // 4. Làm mịn viền
    if(this.config.edgeSmoothing.alphaSmoothing) {
      this.smoothAlphaChannel(this.config.edgeSmoothing.featherRadius);
    }
    
    // Đặt lại imageData đã xử lý vào canvas
    this.ctx.putImageData(this.imageData, 0, 0);
  }

  /**
   * 🛡️ FALLBACK XỬ LÝ NẾU CÁC TÍNH NĂNG MỚI KHÔNG HỖ TRỢ
   */
  async fallbackProcessImage(image) {
    console.warn('⚠️ Sử dụng chế độ xử lý fallback tương thích ngược');
    // Khởi tạo canvas nếu chưa có
    if (!this.canvas || this.canvas.width !== image.width || this.canvas.height !== image.height) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = image.width;
      this.canvas.height = image.height;
      this.ctx = this.canvas.getContext('2d');
    }
    
    // Vẽ ảnh gốc vào canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(image, 0, 0);
    
    // Lấy imageData để xử lý
    this.imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    this.width = this.canvas.width;
    this.height = this.canvas.height;
    
    console.log(`📊 Kích thước ảnh: ${this.width}x${this.height} pixels`);
    
    // Thực thi pipeline xử lý
    await this.executeProcessingPipeline();
    
    return this.canvas;
  }
            
            if (typeof image === 'string') {
                img.crossOrigin = 'anonymous';
                img.src = image;
            }

            img.onload = () => {
                this.width = img.width;
                this.height = img.height;
                
                this.canvas = document.createElement('canvas');
                this.canvas.width = this.width;
                this.canvas.height = this.height;
                this.ctx = this.canvas.getContext('2d');
                this.ctx.drawImage(img, 0, 0);
                this.imageData = this.ctx.getImageData(0, 0, this.width, this.height);
                
                // Thực hiện pipeline xử lý
                this.executeProcessingPipeline()
                    .then(() => resolve(this.canvas))
                    .catch(reject);
            };

            img.onerror = reject;
        });
    }

    /**
     * Pipeline xử lý chính - thực hiện tất cả các bước xóa nền và bóng
     */
    async executeProcessingPipeline() {
        console.time('Total processing time');
        
        // Bước 1: Tiền xử lý ảnh - chuẩn hóa, giảm nhiễu
        await this.preprocessImage();
        
        // Bước 2: Phân đoạn ảnh - tách đối tượng khỏi nền
        await this.segmentImage();
        
        // Bước 3: Phát hiện và xử lý bóng
        await this.detectAndRemoveShadows();
        
        // Bước 4: Làm mịn cạnh và alpha channel
        await this.smoothEdges();
        
        // Bước 5: Hậu xử lý - cải thiện chất lượng
        await this.postprocessImage();
        
        console.timeEnd('Total processing time');
        
        // Cập nhật imageData lên canvas
        this.ctx.putImageData(this.imageData, 0, 0);
    }

    /**
     * Tiền xử lý ảnh: giảm nhiễu, chuẩn hóa màu sắc
     */
    async preprocessImage() {
        console.log('Bắt đầu tiền xử lý ảnh...');
        
        // Áp dụng Gaussian Blur để giảm nhiễu
        await this.applyGaussianBlur(1.5);
        
        // Tự động cân bằng trắng nếu được bật
        if (this.config.colorCorrection.autoWhiteBalance) {
            await this.autoWhiteBalance();
        }
        
        // Tăng cường độ tương phản
        if (this.config.colorCorrection.contrastEnhancement) {
            await this.enhanceContrast();
        }
        
        console.log('Hoàn thành tiền xử lý');
    }

    /**
     * Áp dụng Gaussian Blur để giảm nhiễu
     */
    async applyGaussianBlur(sigma) {
        const data = this.imageData.data;
        const kernel = this.createGaussianKernel(sigma);
        const kernelSize = kernel.length;
        const halfKernel = Math.floor(kernelSize / 2);
        
        // Tạo bản sao dữ liệu
        const tempData = new Uint8ClampedArray(data);
        
        // Áp dụng blur theo chiều ngang
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                let r = 0, g = 0, b = 0;
                let weightSum = 0;
                
                for (let k = -halfKernel; k <= halfKernel; k++) {
                    const nx = Math.min(Math.max(x + k, 0), this.width - 1);
                    const idx = (y * this.width + nx) * 4;
                    const weight = kernel[k + halfKernel];
                    
                    r += tempData[idx] * weight;
                    g += tempData[idx + 1] * weight;
                    b += tempData[idx + 2] * weight;
                    weightSum += weight;
                }
                
                const idx = (y * this.width + x) * 4;
                data[idx] = r / weightSum;
                data[idx + 1] = g / weightSum;
                data[idx + 2] = b / weightSum;
            }
        }
        
        // Áp dụng blur theo chiều dọc
        const tempData2 = new Uint8ClampedArray(data);
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                let r = 0, g = 0, b = 0;
                let weightSum = 0;
                
                for (let k = -halfKernel; k <= halfKernel; k++) {
                    const ny = Math.min(Math.max(y + k, 0), this.height - 1);
                    const idx = (ny * this.width + x) * 4;
                    const weight = kernel[k + halfKernel];
                    
                    r += tempData2[idx] * weight;
                    g += tempData2[idx + 1] * weight;
                    b += tempData2[idx + 2] * weight;
                    weightSum += weight;
                }
                
                const idx = (y * this.width + x) * 4;
                data[idx] = r / weightSum;
                data[idx + 1] = g / weightSum;
                data[idx + 2] = b / weightSum;
            }
        }
    }

    /**
     * Tạo kernel Gaussian cho blur
     */
    createGaussianKernel(sigma) {
        const size = Math.ceil(sigma * 6) | 1;
        const half = size >> 1;
        const kernel = [];
        const twoSigmaSq = 2 * sigma * sigma;
        
        let sum = 0;
        for (let i = 0; i < size; i++) {
            const x = i - half;
            const value = Math.exp(-(x * x) / twoSigmaSq);
            kernel.push(value);
            sum += value;
        }
        
        // Chuẩn hóa kernel
        return kernel.map(v => v / sum);
    }

    /**
     * Tự động cân bằng trắng
     */
    async autoWhiteBalance() {
        const data = this.imageData.data;
        let rSum = 0, gSum = 0, bSum = 0;
        const pixelCount = this.width * this.height;
        
        // Tính trung bình màu
        for (let i = 0; i < pixelCount; i++) {
            const idx = i * 4;
            rSum += data[idx];
            gSum += data[idx + 1];
            bSum += data[idx + 2];
        }
        
        const rAvg = rSum / pixelCount;
        const gAvg = gSum / pixelCount;
        const bAvg = bSum / pixelCount;
        const grayAvg = (rAvg + gAvg + bAvg) / 3;
        
        // Tính hệ số cân bằng
        const rScale = grayAvg / rAvg;
        const gScale = grayAvg / gAvg;
        const bScale = grayAvg / bAvg;
        
        // Áp dụng cân bằng
        for (let i = 0; i < pixelCount; i++) {
            const idx = i * 4;
            data[idx] = Math.min(255, data[idx] * rScale);
            data[idx + 1] = Math.min(255, data[idx + 1] * gScale);
            data[idx + 2] = Math.min(255, data[idx + 2] * bScale);
        }
    }

    /**
     * Tăng cường độ tương phản bằng cách sử dụng CLAHE (adaptive histogram equalization)
     */
    async enhanceContrast() {
        const data = this.imageData.data;
        const pixelCount = this.width * this.height;
        
        // Tính histogram
        const histogram = new Array(256).fill(0);
        for (let i = 0; i < pixelCount; i++) {
            const idx = i * 4;
            const gray = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
            histogram[gray]++;
        }
        
        // Tính CDF (Cumulative Distribution Function)
        const cdf = new Array(256).fill(0);
        cdf[0] = histogram[0];
        for (let i = 1; i < 256; i++) {
            cdf[i] = cdf[i - 1] + histogram[i];
        }
        
        // Tìm giá trị CDF nhỏ nhất khác 0
        const cdfMin = cdf.find(v => v > 0);
        const cdfMax = cdf[255];
        
        // Áp dụng equalization
        for (let i = 0; i < pixelCount; i++) {
            const idx = i * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            
            // Áp dụng phép biến đổi
            data[idx] = Math.round(((cdf[r] - cdfMin) / (cdfMax - cdfMin)) * 255);
            data[idx + 1] = Math.round(((cdf[g] - cdfMin) / (cdfMax - cdfMin)) * 255);
            data[idx + 2] = Math.round(((cdf[b] - cdfMin) / (cdfMax - cdfMin)) * 255);
        }
    }

    /**
     * Phân đoạn ảnh bằng thuật toán GrabCut cải tiến để tách đối tượng chính
     */
    async segmentImage() {
        console.log('Bắt đầu phân đoạn ảnh với thuật toán GrabCut cải tiến...');
        
        const data = this.imageData.data;
        const mask = new Uint8Array(this.width * this.height);
        
        // Bước 1: Tạo mặt nạ ban đầu dựa trên biên ảnh và pixel nền
        this.generateInitialMask(mask);
        
        // Bước 2: Thực hiện thuật toán GrabCut
        await this.runGrabCut(mask);
        
        // Bước 3: Áp dụng mặt nạ alpha channel
        this.applyMaskToAlpha(mask);
        
        console.log('Hoàn thành phân đoạn ảnh');
    }

    /**
     * Tạo mặt nạ ban đầu - phát hiện các pixel có khả năng là nền
     */
    generateInitialMask(mask) {
        const data = this.imageData.data;
        
        // Phân tích các pixel ở cạnh để xác định màu nền phổ biến
        const edgePixels = [];
        const edgeWidth = Math.min(20, Math.floor(this.width * 0.05));
        const edgeHeight = Math.min(20, Math.floor(this.height * 0.05));
        
        // Thu thập pixel ở viền ảnh (có khả năng là nền)
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < edgeWidth; x++) {
                const idx = (y * this.width + x) * 4;
                edgePixels.push({r: data[idx], g: data[idx + 1], b: data[idx + 2]});
            }
            for (let x = this.width - edgeWidth; x < this.width; x++) {
                const idx = (y * this.width + x) * 4;
                edgePixels.push({r: data[idx], g: data[idx + 1], b: data[idx + 2]});
            }
        }
        
        for (let x = 0; x < this.width; x++) {
            for (let y = 0; y < edgeHeight; y++) {
                const idx = (y * this.width + x) * 4;
                edgePixels.push({r: data[idx], g: data[idx + 1], b: data[idx + 2]});
            }
            for (let y = this.height - edgeHeight; y < this.height; y++) {
                const idx = (y * this.width + x) * 4;
                edgePixels.push({r: data[idx], g: data[idx + 1], b: data[idx + 2]});
            }
        }
        
        // Tính màu nền trung bình
        const bgColor = this.calculateAverageColor(edgePixels);
        console.log('Màu nền trung bình phát hiện:', bgColor);
        
        // Phân loại mỗi pixel dựa trên khoảng cách màu sắc
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const idx = (y * this.width + x) * 4;
                const pixelColor = {r: data[idx], g: data[idx + 1], b: data[idx + 2]};
                const distance = this.calculateColorDistance(pixelColor, bgColor);
                
                // 0 = chắc chắn là nền, 1 = có thể là đối tượng
                if (distance < 30) { // Ngưỡng khoảng cách màu
                    mask[y * this.width + x] = 0; // Nền
                } else {
                    mask[y * this.width + x] = 1; // Đối tượng tiềm năng
                }
            }
        }
        
        // Áp dụng morphological operations để làm sạch mặt nạ
        this.applyMorphologicalOperations(mask);
    }

    /**
     * Tính khoảng cách màu sắc (CIE76 color space)
     */
    calculateColorDistance(color1, color2) {
        // Chuyển RGB sang Lab để tính khoảng cách chính xác hơn
        const lab1 = this.rgbToLab(color1.r, color1.g, color1.b);
        const lab2 = this.rgbToLab(color2.r, color2.g, color2.b);
        
        // Tính khoảng cách Euclidean trong không gian Lab
        return Math.sqrt(
            Math.pow(lab1.l - lab2.l, 2) +
            Math.pow(lab1.a - lab2.a, 2) +
            Math.pow(lab1.b - lab2.b, 2)
        );
    }

    /**
     * Chuyển RGB sang không gian màu Lab (để phân biệt màu chính xác hơn)
     */
    rgbToLab(r, g, b) {
        // Chuẩn hóa RGB
        r /= 255; g /= 255; b /= 255;
        
        // Chuyển RGB sang XYZ
        r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
        g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
        b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
        
        r *= 100; g *= 100; b *= 100;
        
        let x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
        let y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
        let z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;
        
        // Chuyển XYZ sang Lab
        x /= 95.047; y /= 100.000; z /= 108.883;
        
        x = x > 0.008856 ? Math.pow(x, 1/3) : 7.787 * x + 16/116;
        y = y > 0.008856 ? Math.pow(y, 1/3) : 7.787 * y + 16/116;
        z = z > 0.008856 ? Math.pow(z, 1/3) : 7.787 * z + 16/116;
        
        return {
            l: 116 * y - 16,
            a: 500 * (x - y),
            b: 200 * (y - z)
        };
    }

    /**
     * Tính màu trung bình từ một tập hợp các pixel
     */
    calculateAverageColor(pixels) {
        let r = 0, g = 0, b = 0;
        pixels.forEach(p => {
            r += p.r;
            g += p.g;
            b += p.b;
        });
        return {
            r: r / pixels.length,
            g: g / pixels.length,
            b: b / pixels.length
        };
    }

    /**
     * Thực hiện thuật toán GrabCut để tinh chỉnh mặt nạ
     */
    async runGrabCut(mask) {
        const data = this.imageData.data;
        const { iterations } = this.config.grabCut;
        
        // Thu thập các mẫu nền và đối tượng
        let bgSamples = [];
        let fgSamples = [];
        
        for (let iter = 0; iter < iterations; iter++) {
            // Cập nhật mẫu
            bgSamples = [];
            fgSamples = [];
            
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    const idx = (y * this.width + x) * 4;
                    const pixel = {r: data[idx], g: data[idx + 1], b: data[idx + 2]};
                    
                    if (mask[y * this.width + x] === 0) {
                        bgSamples.push(pixel);
                    } else {
                        fgSamples.push(pixel);
                    }
                }
            }
            
            // Tính mô hình Gaussian cho nền và đối tượng
            const bgModel = this.fitGaussianModel(bgSamples);
            const fgModel = this.fitGaussianModel(fgSamples);
            
            // Phân loại lại các pixel dựa trên khả năng thuộc về nền/đối tượng
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    const idx = (y * this.width + x) * 4;
                    const pixel = {r: data[idx], g: data[idx + 1], b: data[idx + 2]};
                    
                    const bgProb = this.calculateGaussianProbability(pixel, bgModel);
                    const fgProb = this.calculateGaussianProbability(pixel, fgModel);
                    
                    // Cập nhật mặt nạ
                    mask[y * this.width + x] = fgProb > bgProb ? 1 : 0;
                }
            }
            
            console.log(`Hoàn thành vòng lặp GrabCut ${iter + 1}/${iterations}`);
        }
    }

    /**
     * Khớp mô hình Gaussian với một tập hợp các mẫu màu
     */
    fitGaussianModel(samples) {
        if (samples.length === 0) {
            return { mean: {r: 0, g: 0, b: 0}, covariance: [[1,0,0],[0,1,0],[0,0,1]] };
        }
        
        // Tính trung bình
        const mean = this.calculateAverageColor(samples);
        
        // Tính ma trận hiệp phương sai
        const covariance = [[0,0,0],[0,0,0],[0,0,0]];
        samples.forEach(p => {
            const dr = p.r - mean.r;
            const dg = p.g - mean.g;
            const db = p.b - mean.b;
            
            covariance[0][0] += dr * dr;
            covariance[0][1] += dr * dg;
            covariance[0][2] += dr * db;
            covariance[1][0] += dg * dr;
            covariance[1][1] += dg * dg;
            covariance[1][2] += dg * db;
            covariance[2][0] += db * dr;
            covariance[2][1] += db * dg;
            covariance[2][2] += db * db;
        });
        
        const n = samples.length - 1;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                covariance[i][j] /= n;
            }
        }
        
        return { mean, covariance };
    }

    /**
     * Tính xác suất của một điểm dữ liệu theo mô hình Gaussian
     */
    calculateGaussianProbability(pixel, model) {
        const { mean, covariance } = model;
        const dr = pixel.r - mean.r;
        const dg = pixel.g - mean.g;
        const db = pixel.b - mean.b;
        
        // Đơn giản hóa: tính khoảng cách Mahalanobis (có thể tối ưu thêm)
        const dist = dr*dr + dg*dg + db*db;
        return Math.exp(-dist / (2 * this.config.grabCut.gamma));
    }

    /**
     * Áp dụng các phép toán hình thái học (morphological) để làm sạch mặt nạ
     */
    applyMorphologicalOperations(mask) {
        // Áp dụng erosion sau đó dilation (opening) để loại bỏ nhiễu
        this.applyErosion(mask);
        this.applyDilation(mask);
    }

    /**
     * Thu hẹp mặt nạ (erosion)
     */
    applyErosion(mask) {
        const tempMask = new Uint8Array(mask);
        const kernelSize = 3;
        const half = Math.floor(kernelSize / 2);
        
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                let allForeground = true;
                for (let ky = -half; ky <= half; ky++) {
                    for (let kx = -half; kx <= half; kx++) {
                        const ny = y + ky;
                        const nx = x + kx;
                        if (ny >= 0 && ny < this.height && nx >= 0 && nx < this.width) {
                            if (tempMask[ny * this.width + nx] === 0) {
                                allForeground = false;
                                break;
                            }
                        }
                    }
                    if (!allForeground) break;
                }
                mask[y * this.width + x] = allForeground ? 1 : 0;
            }
        }
    }

    /**
     * Mở rộng mặt nạ (dilation)
     */
    applyDilation(mask) {
        const tempMask = new Uint8Array(mask);
        const kernelSize = 3;
        const half = Math.floor(kernelSize / 2);
        
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                let anyForeground = false;
                for (let ky = -half; ky <= half; ky++) {
                    for (let kx = -half; kx <= half; kx++) {
                        const ny = y + ky;
                        const nx = x + kx;
                        if (ny >= 0 && ny < this.height && nx >= 0 && nx < this.width) {
                            if (tempMask[ny * this.width + nx] === 1) {
                                anyForeground = true;
                                break;
                            }
                        }
                    }
                    if (anyForeground) break;
                }
                mask[y * this.width + x] = anyForeground ? 1 : 0;
            }
        }
    }

    /**
     * Áp dụng mặt nạ vào kênh alpha của ảnh
     */
    applyMaskToAlpha(mask) {
        const data = this.imageData.data;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const idx = (y * this.width + x) * 4;
                data[idx + 3] = mask[y * this.width + x] * 255;
            }
        }
    }

    /**
     * Phát hiện và loại bỏ bóng khỏi ảnh, tạo bóng tự nhiên mới nếu cần
     */
    async detectAndRemoveShadows() {
        console.log('Bắt đầu phát hiện và xử lý bóng...');
        
        const data = this.imageData.data;
        const shadowMask = new Uint8Array(this.width * this.height);
        
        // Bước 1: Phát hiện các vùng có khả năng là bóng
        await this.detectShadowRegions(shadowMask);
        
        // Bước 2: Loại bỏ các bóng không mong muốn và tinh chỉnh
        await this.refineShadows(shadowMask);
        
        // Bước 3: Có thể tạo bóng tự nhiên mới dưới đối tượng
        await this.generateNaturalShadow(shadowMask);
        
        console.log('Hoàn thành xử lý bóng');
    }

    /**
     * Phát hiện các vùng bóng trong ảnh dựa trên đặc trưng ánh sáng
     */
    async detectShadowRegions(shadowMask) {
        const data = this.imageData.data;
        const { threshold, blurRadius } = this.config.shadowDetection;
        
        // Tính độ sáng (luminance) cho mỗi pixel
        const luminance = new Float32Array(this.width * this.height);
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const idx = (y * this.width + x) * 4;
                if (data[idx + 3] === 0) continue; // Bỏ qua pixel nền
                
                // Công thức độ sáng: 0.299*R + 0.587*G + 0.114*B
                luminance[y * this.width + x] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
            }
        }
        
        // Làm mịn độ sáng để giảm nhiễu
        const blurredLuminance = await this.blur1DArray(luminance, blurRadius);
        
        // Tìm độ sáng trung bình của các pixel đối tượng (không phải nền)
        let validPixels = 0;
        let avgLuminance = 0;
        for (let i = 0; i < this.width * this.height; i++) {
            if (data[i * 4 + 3] > 0) {
                avgLuminance += blurredLuminance[i];
                validPixels++;
            }
        }
        avgLuminance /= validPixels;
        
        // Ngưỡng phát hiện bóng
        const shadowThreshold = avgLuminance * threshold;
        
        // Đánh dấu các pixel là bóng
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const idx = y * this.width + x;
                if (data[idx * 4 + 3] === 0) continue;
                
                if (blurredLuminance[idx] < shadowThreshold) {
                    shadowMask[idx] = 1;
                } else {
                    shadowMask[idx] = 0;
                }
            }
        }
        
        // Lọc các vùng bóng quá nhỏ
        this.filterSmallRegions(shadowMask, this.config.shadowDetection.minShadowArea);
    }

    /**
     * Làm mịn mảng 1 chiều (dùng cho độ sáng)
     */
    async blur1DArray(array, sigma) {
        const result = new Float32Array(array.length);
        const kernel = this.createGaussianKernel(sigma);
        const half = Math.floor(kernel.length / 2);
        
        // Làm mịn theo chiều ngang
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                let sum = 0;
                let weightSum = 0;
                for (let k = -half; k <= half; k++) {
                    const nx = Math.min(Math.max(x + k, 0), this.width - 1);
                    const idx = y * this.width + nx;
                    const weight = kernel[k + half];
                    sum += array[idx] * weight;
                    weightSum += weight;
                }
                result[y * this.width + x] = sum / weightSum;
            }
        }
        
        // Làm mịn theo chiều dọc
        const finalResult = new Float32Array(result.length);
        for (let x = 0; x < this.width; x++) {
            for (let y = 0; y < this.height; y++) {
                let sum = 0;
                let weightSum = 0;
                for (let k = -half; k <= half; k++) {
                    const ny = Math.min(Math.max(y + k, 0), this.height - 1);
                    const idx = ny * this.width + x;
                    const weight = kernel[k + half];
                    sum += result[idx] * weight;
                    weightSum += weight;
                }
                finalResult[y * this.width + x] = sum / weightSum;
            }
        }
        
        return finalResult;
    }

    /**
     * Lọc bỏ các vùng nhỏ không đáng kể trong mặt nạ
     */
    filterSmallRegions(mask, minArea) {
        // Sử dụng thuật toán Connected Component Analysis
        const visited = new Uint8Array(this.width * this.height);
        const regions = [];
        
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const idx = y * this.width + x;
                if (mask[idx] === 1 && visited[idx] === 0) {
                    // BFS để tìm vùng liên thông
                    const region = [];
                    const queue = [[x, y]];
                    visited[idx] = 1;
                    
                    while (queue.length > 0) {
                        const [cx, cy] = queue.shift();
                        region.push([cx, cy]);
                        
                        // Kiểm tra 4 hướng lân cận
                        const neighbors = [[cx-1, cy], [cx+1, cy], [cx, cy-1], [cx, cy+1]];
                        for (const [nx, ny] of neighbors) {
                            if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                                const nidx = ny * this.width + nx;
                                if (mask[nidx] === 1 && visited[nidx] === 0) {
                                    visited[nidx] = 1;
                                    queue.push([nx, ny]);
                                }
                            }
                        }
                    }
                    
                    regions.push(region);
                }
            }
        }
        
        // Xóa các vùng có diện tích nhỏ hơn ngưỡng
        for (const region of regions) {
            if (region.length < minArea) {
                for (const [x, y] of region) {
                    mask[y * this.width + x] = 0;
                }
            }
        }
    }

    /**
     * Tinh chỉnh các bóng đã phát hiện, loại bỏ các bóng không tự nhiên
     */
    async refineShadows(shadowMask) {
        const data = this.imageData.data;
        
        // Phục hồi màu sắc ban đầu cho các pixel không còn được coi là bóng
        // (Logic phục hồi có thể phức tạp hơn, đây là phiên bản đơn giản)
        for (let i = 0; i < this.width * this.height; i++) {
            if (shadowMask[i] === 1) {
                // Đặt alpha về 0 để xóa bóng (hoặc có thể tinh chỉnh để giữ lại bóng nhẹ)
                // data[i * 4 + 3] = 0; // Lưu ý: bỏ comment nếu muốn xóa hoàn toàn bóng
                
                // Hoặc giảm độ trong suốt để tạo bóng nhẹ tự nhiên
                data[i * 4 + 3] = Math.min(data[i * 4 + 3], 100);
            }
        }
    }

    /**
     * Tạo bóng tự nhiên mới dưới đối tượng (nếu muốn)
     */
    async generateNaturalShadow(shadowMask) {
        const data = this.imageData.data;
        
        // Tìm đáy của đối tượng để đặt bóng
        let bottomMost = 0;
        for (let y = this.height - 1; y >= 0; y--) {
            for (let x = 0; x < this.width; x++) {
                if (data[(y * this.width + x) * 4 + 3] > 128) {
                    bottomMost = y;
                    y = -1;
                    break;
                }
            }
        }
        
        // Tạo bóng gradient mờ dưới đối tượng
        const shadowHeight = 30;
        const startY = bottomMost + 5;
        
        for (let y = startY; y < Math.min(startY + shadowHeight, this.height); y++) {
            const alphaGradient = 1 - (y - startY) / shadowHeight;
            for (let x = Math.floor(this.width * 0.3); x < Math.floor(this.width * 0.7); x++) {
                const idx = (y * this.width + x) * 4;
                if (data[idx + 3] === 0) { // Chỉ áp dụng cho pixel nền
                    data[idx] = 0;
                    data[idx + 1] = 0;
                    data[idx + 2] = 0;
                    data[idx + 3] = alphaGradient * 80; // Bóng mờ
                }
            }
        }
    }

    /**
     * Làm mịn các cạnh của đối tượng để tạo hiệu ứng chuyển tiếp mượt mà
     */
    async smoothEdges() {
        console.log('Bắt đầu làm mịn cạnh...');
        
        const data = this.imageData.data;
        const { featherRadius } = this.config.edgeSmoothing;
        
        // Tạo bản sao của kênh alpha
        const alphaChannel = new Uint8ClampedArray(this.width * this.height);
        for (let i = 0; i < this.width * this.height; i++) {
            alphaChannel[i] = data[i * 4 + 3];
        }
        
        // Áp dụng Gaussian Blur lên kênh alpha để làm mịn cạnh
        const blurredAlpha = await this.blur1DArray(alphaChannel, featherRadius);
        
        // Cập nhật lại kênh alpha
        for (let i = 0; i < this.width * this.height; i++) {
            data[i * 4 + 3] = blurredAlpha[i];
        }
        
        console.log('Hoàn thành làm mịn cạnh');
    }

    /**
     * Hậu xử lý - các bước cuối cùng để cải thiện chất lượng ảnh
     */
    async postprocessImage() {
        console.log('Bắt đầu hậu xử lý...');
        
        // Áp dụng làm sắc nét ảnh (sharpening) cho đối tượng
        await this.applySharpening();
        
        console.log('Hoàn thành hậu xử lý');
    }

    /**
     * Áp dụng thuật toán làm sắc nét để tăng cường chi tiết
     */
    async applySharpening() {
        const data = this.imageData.data;
        const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0]; // Kernel sharpening đơn giản
        const half = 1;
        
        const tempData = new Uint8ClampedArray(data);
        
        for (let y = 1; y < this.height - 1; y++) {
            for (let x = 1; x < this.width - 1; x++) {
                const idx = (y * this.width + x) * 4;
                if (data[idx + 3] === 0) continue; // Bỏ qua pixel nền
                
                let r = 0, g = 0, b = 0;
                let kid = 0;
                
                for (let ky = -half; ky <= half; ky++) {
                    for (let kx = -half; kx <= half; kx++) {
                        const nidx = ((y + ky) * this.width + (x + kx)) * 4;
                        const weight = kernel[kid++];
                        r += tempData[nidx] * weight;
                        g += tempData[nidx + 1] * weight;
                        b += tempData[nidx + 2] * weight;
                    }
                }
                
                data[idx] = Math.min(255, Math.max(0, r));
                data[idx + 1] = Math.min(255, Math.max(0, g));
                data[idx + 2] = Math.min(255, Math.max(0, b));
            }
        }
    }

    /**
     * Trả về canvas đã xử lý để sử dụng
     */
    getProcessedCanvas() {
        return this.canvas;
    }

    /**
     * Tải ảnh đã xử lý dưới dạng PNG với nền trong suốt
     */
    downloadProcessedImage(filename = 'processed_image.png') {
        if (!this.canvas) return;
        
        const link = document.createElement('a');
        link.download = filename;
        link.href = this.canvas.toDataURL('image/png');
        link.click();
    }
}

// Xuất class để sử dụng trong các file khác
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PhotoRoomIntegration;
} else {
    window.PhotoRoomIntegration = PhotoRoomIntegration;
}

/**
 * Ví dụ sử dụng:
 * 
 * const processor = new PhotoRoomIntegration();
 * const img = document.getElementById('input-image');
 * processor.processImage(img).then(canvas => {
 *     document.body.appendChild(canvas);
 *     processor.downloadProcessedImage('my_image_no_bg.png');
 * });
 */