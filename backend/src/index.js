import config from './config.js';
import { startServer } from './server.js';

let server;

async function main() {
  const isMCPServer = process.argv.includes('--mcp');

  if (isMCPServer) {
    const { startMCPServer } = await import('./mcp/index.js');
    await startMCPServer();
  } else {
    server = startServer(config.PORT, config.HOST);
  }
}

main().catch((e) => {
  console.error('Failed to start:', e);
  process.exit(1);
});

process.on('SIGTERM', () => {
  if (server) server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  if (server) server.close(() => process.exit(0));
});
