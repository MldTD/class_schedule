import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'

// 多端构建：web 走根路径；Tauri / Capacitor 壳内走相对路径，产物目录隔离，
// 避免 file:// / capacitor 协议下资源 404 以及产物互相覆盖。
export default defineConfig(({ mode }) => {
  const embedded = mode === 'tauri' || mode === 'capacitor'
  return {
    base: embedded ? './' : '/',
    plugins: [vue(), UnoCSS()],
    build: {
      outDir: mode === 'tauri' ? 'dist-tauri' : 'dist',
      target: 'es2019',
      chunkSizeWarningLimit: 1500,
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: {
            vue: ['vue'],
            xlsx: ['xlsx'],
            'element-plus': ['element-plus', '@element-plus/icons-vue']
          }
        }
      }
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true
    },
    clearScreen: false
  }
})
