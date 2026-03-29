import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import viteCompression from 'vite-plugin-compression'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    viteCompression({
      algorithm: 'gzip',
      threshold: 10240,
    }),
    viteCompression({
      algorithm: 'brotliCompress',
      threshold: 10240,
    }),
  ],
  optimizeDeps: {
    include: ["jszip"]
  },
  assetsInclude: ["**/*.wasm"],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'codemirror': ['@codemirror/state', '@codemirror/view', '@codemirror/lang-python'],
          'pyodide': ['pyodide'],
          'konva': ['konva', 'react-konva'],
        },
      },
    },
  },
  preview: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    }
  },
  worker: {
    format: "es"
  }
})
