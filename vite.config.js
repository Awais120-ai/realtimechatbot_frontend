import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },

  server: {
    host: '0.0.0.0',
    port: 5174,

    https: {
      key: fs.readFileSync(
        path.resolve(
          import.meta.dirname,
          './192.168.18.83+2-key.pem'
        )
      ),

      cert: fs.readFileSync(
        path.resolve(
          import.meta.dirname,
          './192.168.18.83+2.pem'
        )
      ),
    },

    proxy: {
      '/api': {
        target: 'http://192.168.18.83:8001',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
});