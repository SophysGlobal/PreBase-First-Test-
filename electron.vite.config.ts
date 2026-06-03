import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@core': resolve('src/core')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@core': resolve('src/core')
      }
    },
    worker: {
      format: 'es'
    },
    optimizeDeps: {
      include: ['monaco-editor']
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('react-force-graph') || id.includes('force-graph') || id.includes('d3-')) {
              return 'force-graph'
            }
          }
        }
      }
    },
    plugins: [react()]
  }
})
