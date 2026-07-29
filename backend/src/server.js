import express from 'express';
import cors from 'cors';
import http from 'http';
import { errorHandler, notFound } from './middleware/error-handler.js';
import workspaceRoutes from './routes/workspace.js';
import fileRoutes from './routes/files.js';
import { setupWebSocket } from './ws/sync-engine.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, data: { status: 'ok' } });
  });

  app.use('/api/workspaces', workspaceRoutes);
  app.use('/api/workspaces', fileRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export function startServer(port, host) {
  const app = createApp();
  const server = http.createServer(app);

  setupWebSocket(server);

  server.listen(port, host, () => {
    console.log(`Workspace backend running at http://${host}:${port}`);
    console.log(`WebSocket available at ws://${host}:${port}/ws`);
  });

  return server;
}
