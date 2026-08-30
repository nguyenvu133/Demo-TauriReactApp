import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  // Cấu hình cơ bản
  plugins: [react()],
  
  // Đường dẫn absolute để import dễ dàng
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@components": resolve(__dirname, "./src/components"),
      "@hooks": resolve(__dirname, "./src/hooks"),
      "@core": resolve(__dirname, "./src/core"),
    },
  },
  
  // Build options tối ưu cho PixiJS
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: true, // Dễ debug khi phát triển
    // Tối ưu bundle size
    rollupOptions: {
      output: {
        manualChunks: {
          pixijs: ["pixi.js"],
          react: ["react", "react-dom"],
          dockview: ["dockview"],
        },
      },
    },
  },
  
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || "0.0.0.0",
    // Hỗ trợ CORS để load assets local
    cors: true,
    // Hot module replacement cho development
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : {
          port: 1421,
        },
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  
  // Tối ưu cho PixiJS (tăng hiệu suất)
  optimizeDeps: {
    include: ["pixi.js", "dockview", "react", "react-dom"],
  },
}));