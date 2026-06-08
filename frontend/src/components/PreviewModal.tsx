import { useEffect, useRef, useState } from 'react';
import { pdfjsLib } from '../pdfjs';
import { api } from '../api';
import type { VersionMeta } from '../types';

interface Props {
  documentId: string;
  version: VersionMeta;
  onClose: () => void;
}

export function PreviewModal({ documentId, version, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);

  useEffect(() => {
    (async () => {
      const buf = await api.getVersionPdf(documentId, version._id);
      setBytes(new Uint8Array(buf));
    })();
  }, [documentId, version._id]);

  useEffect(() => {
    if (!bytes || !canvasRef.current) return;
    (async () => {
      const doc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
      setPageCount(doc.numPages);
      const p = await doc.getPage(Math.min(page, doc.numPages));
      const viewport = p.getViewport({ scale: 1 });
      const canvas = canvasRef.current!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;
      await p.render({ canvasContext: ctx, viewport }).promise;
    })();
  }, [bytes, page]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[800px] max-w-[95vw] max-h-[90vh] flex flex-col">
        <div className="px-4 py-3 border-b flex items-center">
          <h3 className="font-medium">
            Preview: {version.label || `v${version.versionNumber}`}
          </h3>
          <div className="flex-1" />
          <button onClick={onClose} className="px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 text-sm">
            Close
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4 bg-slate-100 flex justify-center">
          <canvas ref={canvasRef} className="bg-white shadow" />
        </div>
        <div className="px-4 py-2 border-t flex items-center gap-3">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1 text-sm rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-sm">
            Page {page} / {pageCount || '—'}
          </span>
          <button
            disabled={page >= pageCount}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1 text-sm rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
