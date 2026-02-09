import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    fs: {
      strict: false
    }
  },
  assetsInclude: ['**/*.sql', '**/*.wasm'],
  build: {
    target: 'esnext',
    rollupOptions: {
      external: []
    }
  }
});
