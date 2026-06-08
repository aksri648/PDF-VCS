import { useEffect, useRef, useState } from 'react';
import { pdfjsLib } from '../pdfjs';
import { api } from '../api';
import type { VersionMeta } from '../types';

interface Props {
  documentId: string;
  left: VersionMeta;
  right: VersionMeta;
  onClose: () => void;
}

async function renderPage(canvas: HTMLCanvasElement, bytes: Uint8Array, pageNum: number) {
  const doc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
  if (pageNum < 1 || pageNum > doc.numPages) {
    const ctx = canvas.getContext('2d')!;
    canvas.width = 200;
    canvas.height = 280;
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px sans-serif';
    ctx.fillText('— no page —', 60, 140);
    return;
  }
  const page = await doc.getPage(pageNum);
  const viewport = page.getViewport({ scale: 0.8 });
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx, viewport }).promise;
}

export function DiffViewer({ documentId, left, right, onClose }: Props) {
  const [leftBytes, setLeftBytes] = useState<Uint8Array | null>(null);
  const [rightBytes, setRightBytes] = useState<Uint8Array | null>(null);
  const [page, setPage] = useState(1);
  const leftCanvas = useRef<HTMLCanvasElement>(null);
  const rightCanvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    (async () => {
      const [l, r] = await Promise.all([
        api.getVersionPdf(documentId, left._id),
        api.getVersionPdf(documentId, right._id),
      ]);
      setLeftBytes(new Uint8Array(l));
      setRightBytes(new Uint8Array(r));
    })();
  }, [documentId, left._id, right._id]);

  useEffect(() => {
    if (leftBytes && leftCanvas.current) void renderPage(leftCanvas.current, leftBytes, page);
    if (rightBytes && rightCanvas.current) void renderPage(rightCanvas.current, rightBytes, page);
  }, [leftBytes, rightBytes, page]);

  const changed = right.changedPages.includes(page - 1);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[1100px] max-w-[95vw] max-h-[90vh] flex flex-col">
        <div className="px-4 py-3 border-b flex items-center">
          <h3 className="font-medium">
            Diff: v{left.versionNumber} → v{right.versionNumber}
          </h3>
          <div className="flex-1" />
          <button onClick={onClose} className="px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 text-sm">
            Close
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4 flex justify-around bg-slate-100">
          <div className="text-center">
            <div className="text-xs text-slate-500 mb-1">v{left.versionNumber}</div>
            <canvas
              ref={leftCanvas}
              className={`bg-white shadow ${changed ? 'border-2 border-red-400' : 'border-2 border-green-300'}`}
            />
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-500 mb-1">v{right.versionNumber}</div>
            <canvas
              ref={rightCanvas}
              className={`bg-white shadow ${changed ? 'border-2 border-red-400' : 'border-2 border-green-300'}`}
            />
          </div>
        </div>
        <div className="px-4 py-2 border-t flex items-center gap-3">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            className="px-3 py-1 text-sm rounded bg-slate-100 hover:bg-slate-200"
          >
            Prev
          </button>
          <span className="text-sm">Page {page}</span>
          <button
            onClick={() => setPage(page + 1)}
            className="px-3 py-1 text-sm rounded bg-slate-100 hover:bg-slate-200"
          >
            Next
          </button>
          <div className="flex-1" />
          <span className="text-sm text-slate-600">{right.diffSummary}</span>
        </div>
      </div>
    </div>
  );
}
