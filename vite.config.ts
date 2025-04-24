import { defineConfig, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from "path"; // Import path module
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
/// <reference types="vitest" />
import type { InlineConfig } from 'vitest/node';

// Extend the UserConfig type to include 'test'
interface VitestUserConfigExport extends UserConfig {
  test: InlineConfig;
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-manifest-and-assets',
      buildEnd() {
        // Ensure dist directory exists
        if (!existsSync('dist')) {
          mkdirSync('dist', { recursive: true });
        }
        
        // Copy manifest.json
        copyFileSync('public/manifest.json', 'dist/manifest.json');
        
        // Copy background.js
        copyFileSync('public/background.js', 'dist/background.js');
        
        // Copy contentScript.js
        copyFileSync('public/contentScript.js', 'dist/contentScript.js');
        
        // Copy pdf.worker.min.mjs
        copyFileSync('public/pdf.worker.min.mjs', 'dist/pdf.worker.min.mjs');
        
        // Copy images folder
        if (!existsSync('dist/images')) {
          mkdirSync('dist/images', { recursive: true });
        }
        // Example: Copy individual image if needed
        // if (existsSync('public/images/icon16.png')) {
        //   copyFileSync('public/images/icon16.png', 'dist/images/icon16.png');
        // }
        // Add similar lines for other icons (icon48, icon128)
        if (existsSync('public/images/icon16.png')) copyFileSync('public/images/icon16.png', 'dist/images/icon16.png');
        if (existsSync('public/images/icon48.png')) copyFileSync('public/images/icon48.png', 'dist/images/icon48.png');
        if (existsSync('public/images/icon128.png')) copyFileSync('public/images/icon128.png', 'dist/images/icon128.png');
      }
    }
  ],
  // Add resolve alias configuration
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Add CSS configuration for PostCSS/Tailwind
  css: {
    postcss: './postcss.config.cjs',
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        // Ensure consistent asset file names, remove hash if needed
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`
      }
    },
    sourcemap: false, // Consider disabling sourcemaps for production extension builds
  },
  // Add Vitest configuration
  test: {
    globals: true,
    environment: 'jsdom', // Use jsdom for browser-like environment needed for IndexedDB/chrome mocks
    setupFiles: './src/setupTests.ts',
  },
} as VitestUserConfigExport); 