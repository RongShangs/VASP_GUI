import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:1691',
      '/ws': {
        target: 'ws://localhost:1691',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          antd: ['antd', '@ant-design/icons'],
          editor: ['@monaco-editor/react', 'monaco-editor'],
          terminal: ['@xterm/xterm'],
          charts: ['echarts', 'echarts-for-react'],
        },
      },
    },
  },
});
