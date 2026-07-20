import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';

const SNAPSHOT_PATH = resolve(__dirname, '../backend/data/futurewatch.json');

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'snapshot-dev-serve',
      configureServer(server) {
        server.middlewares.use('/data/futurewatch.json', (_req, res) => {
          if (existsSync(SNAPSHOT_PATH)) {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'no-cache');
            res.end(readFileSync(SNAPSHOT_PATH, 'utf8'));
          } else {
            res.statusCode = 404;
            res.end('{"error":"futurewatch.json not found — run node src/index.js in backend/"}');
          }
        });
      },
    },
  ],
});
