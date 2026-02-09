import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// Plugin to load SQL files as raw text
function sqlPlugin() {
  return {
    name: 'vite-plugin-sql',
    transform(code: string, id: string) {
      if (id.endsWith('.sql')) {
        const sql = fs.readFileSync(id, 'utf-8');
        return {
          code: `export default ${JSON.stringify(sql)}`,
          map: null
        };
      }
    }
  };
}

export default defineConfig({
  plugins: [react(), sqlPlugin()],
  server: {
    port: 5173,
    host: true,
    fs: {
      strict: false
    }
  },
  optimizeDeps: {
    include: ['sql.js']
  },
  assetsInclude: ['**/*.wasm'],
  build: {
    target: 'esnext',
    commonjsOptions: {
      include: [/sql\.js/, /node_modules/]
    }
  },
  worker: {
    format: 'es'
  }
});
