import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  
  resolve: {
    extensions: [".tsx", ".ts", ".jsx", ".js", ".json"],
    alias: {
      "@": resolve(__dirname, "./src"),
      "@components": resolve(__dirname, "./src/components"),
      "@hooks": resolve(__dirname, "./src/hooks"),
      "@core": resolve(__dirname, "./src/core"),
    },
  },
  
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: true,
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
  
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || "0.0.0.0",
    cors: true,
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
  
  optimizeDeps: {
    include: ["pixi.js", "dockview", "react", "react-dom"],
  },
}));
