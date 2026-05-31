import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'node:path';

// §0.32 予報精度ダッシュボード (/accuracy.html) の単独ビルド。
// vite-plugin-singlefile は複数 input 非対応のため、メイン (vite.config.js) と分けて
// 2 パス目としてビルドする (emptyOutDir:false で dist/index.html を消さない)。
export default defineConfig({
  root: 'src',
  publicDir: false, // 1 パス目でコピー済みなので二重コピーしない
  plugins: [viteSingleFile()],
  build: {
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(import.meta.dirname, 'src/accuracy.html'),
      output: { manualChunks: undefined },
    },
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
  },
});
