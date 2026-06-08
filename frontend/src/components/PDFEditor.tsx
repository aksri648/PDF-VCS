import { useEffect, useRef, useState } from 'react';
import { pdfjsLib } from '../pdfjs';
import { usePdfStore, type Annotation } from '../store/pdfStore';

const COLOR = '#facc15';

export function PDFEditor() {
  const pdfBytes = usePdfStore((s) => s.currentPdfBytes);
  const zoom = usePdfStore((s) => s.zoom);
  const currentPage = usePdfStore((s) => s.currentPage);
  const setPageCount = usePdfStore((s) => s.setPageCount);
  const setCurrentPage = usePdfStore((s) => s.setCurrentPage);
  const tool = usePdfStore((s) => s.tool);
  const annotations = usePdfStore((s) => s.annotations);
  const addAnnotation = usePdfStore((s) => s.addAnnotation);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const docRef = useRef<Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']> | null>(null);
  const [drawing, setDrawing] = useState<{ x: number; y: number; path: { x: number; y: number }[] } | null>(null);
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!pdfBytes) {
      docRef.current = null;
      return;
    }
    let cancelled = false;
    (async () => {
      const doc = await pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise;
      if (cancelled) return;
      docRef.current = doc;
      setPageCount(doc.numPages);
      if (currentPage > doc.numPages) setCurrentPage(1);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfBytes]);

  useEffect(() => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;
    let cancelled = false;
    (async () => {
      const page = await doc.getPage(currentPage);
      if (cancelled) return;
      const viewport = page.getViewport({ scale: zoom * 1.5 });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setViewportSize({ w: viewport.width, h: viewport.height });
      const ctx = canvas.getContext('2d')!;
      await page.render({ canvasContext: ctx, viewport }).promise;
    })();
    return () => {
      cancelled = true;
    };
  }, [currentPage, zoom, pdfBytes]);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    overlay.width = viewportSize.w;
    overlay.height = viewportSize.h;
    const ctx = overlay.getContext('2d')!;
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    const pageAnns = annotations.filter((a) => a.page === currentPage - 1);
    for (const a of pageAnns) {
      ctx.strokeStyle = a.color;
      ctx.fillStyle = a.color;
      ctx.lineWidth = 2;
      switch (a.type) {
        case 'text':
          ctx.font = '16px sans-serif';
          ctx.fillText(a.text ?? '', a.x, a.y);
          break;
        case 'highlight':
          ctx.globalAlpha = 0.35;
          ctx.fillRect(a.x, a.y, a.w ?? 100, a.h ?? 18);
          ctx.globalAlpha = 1;
          break;
        case 'rect':
          ctx.strokeRect(a.x, a.y, a.w ?? 80, a.h ?? 50);
          break;
        case 'circle':
          ctx.beginPath();
          ctx.ellipse(a.x + (a.w ?? 40) / 2, a.y + (a.h ?? 40) / 2, (a.w ?? 40) / 2, (a.h ?? 40) / 2, 0, 0, Math.PI * 2);
          ctx.stroke();
          break;
        case 'draw':
          if (a.path && a.path.length > 1) {
            ctx.beginPath();
            ctx.moveTo(a.path[0].x, a.path[0].y);
            for (let i = 1; i < a.path.length; i++) ctx.lineTo(a.path[i].x, a.path[i].y);
            ctx.stroke();
          }
          break;
      }
    }
  }, [annotations, currentPage, viewportSize]);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const sx = viewportSize.w / r.width;
    const sy = viewportSize.h / r.height;
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
  };

  const handleDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === 'select') return;
    const p = getPos(e);
    if (tool === 'text') {
      const text = window.prompt('Text:');
      if (text) {
        addAnnotation({
          id: crypto.randomUUID(),
          page: currentPage - 1,
          type: 'text',
          x: p.x,
          y: p.y,
          text,
          color: '#000000',
        });
      }
      return;
    }
    setDrawing({ x: p.x, y: p.y, path: [p] });
  };

  const handleMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    if (tool === 'draw') {
      const p = getPos(e);
      setDrawing({ ...drawing, path: [...drawing.path, p] });
      const ctx = overlayRef.current?.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = COLOR;
        ctx.lineWidth = 2;
        const last = drawing.path[drawing.path.length - 1];
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    }
  };

  const handleUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    const end = getPos(e);
    const base: Annotation = {
      id: crypto.randomUUID(),
      page: currentPage - 1,
      type: tool,
      x: Math.min(drawing.x, end.x),
      y: Math.min(drawing.y, end.y),
      w: Math.abs(end.x - drawing.x),
      h: Math.abs(end.y - drawing.y),
      color: COLOR,
    };
    if (tool === 'draw') {
      addAnnotation({ ...base, type: 'draw', x: drawing.x, y: drawing.y, color: COLOR, path: drawing.path });
    } else if (tool === 'highlight' || tool === 'rect' || tool === 'circle') {
      addAnnotation(base);
    }
    setDrawing(null);
  };

  if (!pdfBytes) {
    return <div className="flex-1 flex items-center justify-center text-slate-400">No PDF loaded</div>;
  }

  return (
    <div className="flex-1 overflow-auto bg-slate-200 p-4 flex justify-center">
      <div className="relative" style={{ width: viewportSize.w, height: viewportSize.h }}>
        <canvas ref={canvasRef} className="block bg-white shadow" />
        <canvas
          ref={overlayRef}
          className="absolute inset-0"
          style={{ cursor: tool === 'select' ? 'default' : 'crosshair' }}
          onMouseDown={handleDown}
          onMouseMove={handleMove}
          onMouseUp={handleUp}
        />
      </div>
    </div>
  );
}
