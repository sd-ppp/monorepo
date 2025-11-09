import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@sdppp/mock-photoshop': path.resolve(__dirname, '../src'),
    },
  },
  server: {
    port: 5173,
    open: false,
  },
  preview: {
    port: 4173,
  },
});
