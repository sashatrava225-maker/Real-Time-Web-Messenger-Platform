import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://web:8000',
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: 'ws://web:8000',
        ws: true,
        changeOrigin: true,
        secure: false,
      },
      '/media': {
        target: 'http://web:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
