import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, res) => {
            console.error('[Vite Proxy Error]:', err.message);
            const response = res as any;
            if (response && typeof response.writeHead === 'function' && !response.headersSent) {
              response.writeHead(502, { 'Content-Type': 'application/json' });
              response.end(JSON.stringify({ message: 'Backend API server on port 5000 is unreachable. Please make sure backend is running.' }));
            }
          });
        }
      }
    }
  }
})
