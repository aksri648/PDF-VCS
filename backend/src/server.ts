import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import mongoose from 'mongoose';
import { Server as SocketIOServer } from 'socket.io';
import pdfRoutes from './routes/pdf.routes';
import versionRoutes from './routes/version.routes';
import { attachSocketHandlers } from './socket/socketHandler';

const PORT = Number(process.env.PORT) || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

async function connectMongo(): Promise<string> {
  if (process.env.MONGODB_URI) {
    await mongoose.connect(process.env.MONGODB_URI);
    return process.env.MONGODB_URI;
  }

  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const mem = await MongoMemoryServer.create();
  const uri = mem.getUri();
  await mongoose.connect(uri);
  return uri;
}

async function main() {
  const uri = await connectMongo();
  console.log(`[pdf-vcs] MongoDB connected: ${uri}`);

  const app = express();
  app.use(cors({ origin: FRONTEND_URL, credentials: true }));
  app.use(express.json({ limit: '10mb' }));

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/pdf', pdfRoutes);
  app.use('/api/versions', versionRoutes);

  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: { origin: FRONTEND_URL, credentials: true },
    maxHttpBufferSize: 100 * 1024 * 1024,
  });

  attachSocketHandlers(io);

  server.listen(PORT, () => {
    console.log(`[pdf-vcs] backend listening on http://localhost:${PORT}`);
  });

  const shutdown = async () => {
    console.log('[pdf-vcs] shutting down...');
    await mongoose.disconnect();
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[pdf-vcs] fatal:', err);
  process.exit(1);
});
