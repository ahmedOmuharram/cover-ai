import { defineConfig, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
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
        
        // Copy images folder (recursive copy not implemented here, 
        // you may need to enhance this for complex directory structures)
        if (!existsSync('dist/images')) {
          mkdirSync('dist/images', { recursive: true });
        }
        // You would need to copy each image individually here
      }
    }
  ],
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
  },
  // Add Vitest configuration
  test: {
    globals: true,
    environment: 'jsdom', // Use jsdom for browser-like environment needed for IndexedDB/chrome mocks
    setupFiles: './src/setupTests.ts',
  },
} as VitestUserConfigExport); 