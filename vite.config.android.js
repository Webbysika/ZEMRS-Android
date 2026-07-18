import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [VitePWA({ disable: true })],
  build: {
    outDir: 'android-dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200
  }
});
