import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { Annotation } from './store/pdfStore';

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace('#', '').match(/.{2}/g);
  if (!m) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(m[0], 16) / 255,
    g: parseInt(m[1], 16) / 255,
    b: parseInt(m[2], 16) / 255,
  };
}

export async function embedAnnotations(
  pdfBytes: Uint8Array,
  annotations: Annotation[]
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(pdfBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();

  for (const ann of annotations) {
    const page = pages[ann.page];
    if (!page) continue;
    const { height } = page.getSize();
    const c = hexToRgb(ann.color);
    const color = rgb(c.r, c.g, c.b);

    switch (ann.type) {
      case 'text':
        page.drawText(ann.text ?? '', {
          x: ann.x,
          y: height - ann.y,
          size: 14,
          font,
          color,
        });
        break;
      case 'highlight':
        page.drawRectangle({
          x: ann.x,
          y: height - ann.y - (ann.h ?? 18),
          width: ann.w ?? 100,
          height: ann.h ?? 18,
          color,
          opacity: 0.35,
        });
        break;
      case 'rect':
        page.drawRectangle({
          x: ann.x,
          y: height - ann.y - (ann.h ?? 50),
          width: ann.w ?? 80,
          height: ann.h ?? 50,
          borderColor: color,
          borderWidth: 2,
        });
        break;
      case 'circle':
        page.drawEllipse({
          x: ann.x + (ann.w ?? 40) / 2,
          y: height - ann.y - (ann.h ?? 40) / 2,
          xScale: (ann.w ?? 40) / 2,
          yScale: (ann.h ?? 40) / 2,
          borderColor: color,
          borderWidth: 2,
        });
        break;
      case 'draw':
        if (ann.path && ann.path.length > 1) {
          for (let i = 1; i < ann.path.length; i++) {
            const a = ann.path[i - 1];
            const b = ann.path[i];
            page.drawLine({
              start: { x: a.x, y: height - a.y },
              end: { x: b.x, y: height - b.y },
              thickness: 2,
              color,
            });
          }
        }
        break;
    }
  }

  return pdf.save();
}

export async function generateThumbnail(pdfBytes: Uint8Array): Promise<string> {
  const { pdfjsLib } = await import('./pdfjs');
  const doc = await pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 0.3 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL('image/png');
}
