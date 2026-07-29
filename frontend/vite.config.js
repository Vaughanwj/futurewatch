import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';

const SNAPSHOT_PATH = resolve(__dirname, '../backend/data/futurewatch.json');
const CAPABILITIES_PATH = resolve(__dirname, '../backend/data/capabilities.json');

function serveJsonFile(server, route, filePath, missingMessage) {
  server.middlewares.use(route, (_req, res) => {
    if (existsSync(filePath)) {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-cache');
      res.end(readFileSync(filePath, 'utf8'));
    } else {
      res.statusCode = 404;
      res.end(`{"error":${JSON.stringify(missingMessage)}}`);
    }
  });
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'snapshot-dev-serve',
      configureServer(server) {
        serveJsonFile(server, '/data/futurewatch.json', SNAPSHOT_PATH, 'futurewatch.json not found — run node src/index.js in backend/');
        serveJsonFile(server, '/data/capabilities.json', CAPABILITIES_PATH, 'capabilities.json not found — run npm run capabilities in backend/');
      },
    },
  ],
});
