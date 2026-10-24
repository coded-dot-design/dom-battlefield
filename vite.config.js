import {defineConfig} from 'vite';
export default defineConfig({base:'./',build:{outDir:'dist',rollupOptions:{output:{entryFileNames:'assets/battlefield.js',assetFileNames:'assets/battlefield.[ext]'}}}});
