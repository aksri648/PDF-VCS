import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { VersionMeta } from '../types';

export interface SocketHandlers {
  onVersionSaved?: (v: VersionMeta) => void;
  onSaveError?: (msg: string) => void;
}

export function useSocket(documentId: string | null, handlers: SocketHandlers) {
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!documentId) return;

    const socket = io({ transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-document', { documentId });
    });

    socket.on('version-saved', (payload: { version: VersionMeta }) => {
      handlersRef.current.onVersionSaved?.(payload.version);
    });

    socket.on('save-error', (payload: { message: string }) => {
      handlersRef.current.onSaveError?.(payload.message);
    });

    return () => {
      socket.emit('leave-document', { documentId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [documentId]);

  return socketRef;
}
