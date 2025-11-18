import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    react() // Support React components (for feedback widget)
  ],
  resolve: {
    // Dedupe React to prevent multiple instances
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
    alias: {
      // Force all React imports to use the same instance from node_modules
      // This is critical when using pnpm with a local package dependency
      'react': path.resolve(__dirname, 'node_modules/.pnpm/react@18.3.1/node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/.pnpm/react-dom@18.3.1_react@18.3.1/node_modules/react-dom'),
      'react/jsx-runtime': path.resolve(__dirname, 'node_modules/.pnpm/react@18.3.1/node_modules/react/jsx-runtime'),
    }
  },
  optimizeDeps: {
    // Pre-bundle and force single instance
    include: ['react', 'react-dom', 'react/jsx-runtime'],
    // Exclude the widget from optimization to let Vite resolve imports fresh
    exclude: ['annotated-feedback']
  }
})
