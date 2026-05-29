import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'node:path';

// 単一 HTML (dist/artifact.html) を生成する。
// Chart.js / Material Symbols は CDN 参照のまま残し (artifact サイズ削減)、
// ローカル JS / CSS だけをインライン化する。
export default defineConfig({
  root: 'src',
  plugins: [viteSingleFile()],
  build: {
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(import.meta.dirname, 'src/index.html'),
      output: {
        // singlefile 用に分割を抑制
        manualChunks: undefined,
      },
    },
    // artifact なので 1 ファイルにまとめる
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
  },
  test: {
    // テストはプロジェクトルート基準で解決する (vite の root='src' を上書き)
    root: import.meta.dirname,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/score/**', 'src/data/**', 'src/utils/**'],
      reporter: ['text', 'html'],
    },
  },
});
