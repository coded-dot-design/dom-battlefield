import {defineConfig} from 'vite';
// modulePreload off: the only dynamic import is the opt-in performance overlay (one small chunk,
// no dependencies of its own), so the preload helper would only add bytes to every load.
export default defineConfig({base:'./',build:{outDir:'dist',modulePreload:false,rollupOptions:{output:{entryFileNames:'assets/battlefield.js',assetFileNames:'assets/battlefield.[ext]'}}}});
