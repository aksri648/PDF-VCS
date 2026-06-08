import { Server as SocketIOServer, Socket } from 'socket.io';
import { appendVersion } from '../services/storageService';

interface PdfChangePayload {
  documentId: string;
  pdfData: ArrayBuffer | Buffer | Uint8Array;
  changedPages?: number[];
  thumbnail?: string;
}

interface RequestSavePayload {
  documentId: string;
  label?: string;
  pdfData: ArrayBuffer | Buffer | Uint8Array;
  thumbnail?: string;
}

const debounceTimers = new Map<string, NodeJS.Timeout>();
const pendingPayloads = new Map<string, PdfChangePayload>();
const AUTOSAVE_DELAY_MS = 2000;

function toBuffer(data: ArrayBuffer | Buffer | Uint8Array): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof Uint8Array) return Buffer.from(data);
  return Buffer.from(new Uint8Array(data));
}

export function attachSocketHandlers(io: SocketIOServer) {
  io.on('connection', (socket: Socket) => {
    socket.on('join-document', ({ documentId }: { documentId: string }) => {
      socket.join(`doc:${documentId}`);
    });

    socket.on('leave-document', ({ documentId }: { documentId: string }) => {
      socket.leave(`doc:${documentId}`);
    });

    socket.on('pdf-change', (payload: PdfChangePayload) => {
      const { documentId } = payload;
      pendingPayloads.set(documentId, payload);

      const existing = debounceTimers.get(documentId);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(async () => {
        const latest = pendingPayloads.get(documentId);
        debounceTimers.delete(documentId);
        pendingPayloads.delete(documentId);
        if (!latest) return;

        try {
          const version = await appendVersion({
            documentId,
            pdfData: toBuffer(latest.pdfData),
            isAutoSave: true,
            thumbnail: latest.thumbnail || '',
          });
          const { pdfData: _omit, ...meta } = version.toObject();
          io.to(`doc:${documentId}`).emit('version-saved', { version: meta });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Autosave failed';
          io.to(`doc:${documentId}`).emit('save-error', { message });
        }
      }, AUTOSAVE_DELAY_MS);

      debounceTimers.set(documentId, timer);
    });

    socket.on('request-save', async (payload: RequestSavePayload) => {
      const { documentId, label, pdfData, thumbnail } = payload;
      try {
        const version = await appendVersion({
          documentId,
          pdfData: toBuffer(pdfData),
          label,
          isAutoSave: false,
          thumbnail: thumbnail || '',
        });
        const { pdfData: _omit, ...meta } = version.toObject();
        io.to(`doc:${documentId}`).emit('version-saved', { version: meta });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Save failed';
        socket.emit('save-error', { message });
      }
    });
  });
}
