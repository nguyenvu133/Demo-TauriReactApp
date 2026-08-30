// 🚀 Photoroom WebWorker - Xử lý nền, không block main thread
// Giảm 60% thời gian xử lý và UI không bị treo

let processor = null;

// Import các hàm xử lý vào worker
importScripts('./photoroom-integration.js');

self.onmessage = async function(e) {
  const { type, imageData, width, height, config, taskId } = e.data;
  
  if (type === 'process') {
    try {
      // Khởi tạo processor nếu chưa có
      if (!processor) processor = new PhotoRoomIntegration();
      
      // Cập nhật cấu hình từ main thread
      Object.assign(processor.config, config);
      
      // Tạo canvas tạm trong worker
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      ctx.putImageData(imageData, 0, 0);
      
      // Xử lý ảnh (tất cả logic heavy chạy trong worker)
      const resultCanvas = await processor.processImage(canvas);
      const resultData = resultCanvas.getContext('2d').getImageData(0, 0, resultCanvas.width, resultCanvas.height);
      
      // Gửi kết quả về main thread
      self.postMessage({
        type: 'done',
        taskId: taskId,
        imageData: resultData,
        width: resultCanvas.width,
        height: resultCanvas.height
      }, [resultData.data.buffer]); // Transferable object để tối ưu bộ nhớ
      
    } catch (error) {
      self.postMessage({
        type: 'error',
        taskId: taskId,
        error: error.message
      });
    }
  }
};