import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        ws: true,
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.warn(`⚠️ [Vite Proxy] Backend unreachable on ${options.target}${req.url} (${err.code})`);
            if (res.writeHead && !res.headersSent) {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                success: false,
                error: 'Backend server is offline or starting up on port 5000. Real-time fallback active.',
                code: 'BACKEND_OFFLINE',
                hint: 'Run "npm run dev" or "node server.js" in the terminal to launch the real-time backend.'
              }));
            }
          });
        }
      },
    },
  },
});
