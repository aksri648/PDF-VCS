import crypto from 'crypto';
import { PDFDocument } from 'pdf-lib';

export interface PageHashes {
  pageCount: number;
  hashes: string[];
}

export async function hashPagesOfPdf(pdfBytes: Buffer | Uint8Array): Promise<PageHashes> {
  const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pageCount = pdf.getPageCount();
  const hashes: string[] = [];

  for (let i = 0; i < pageCount; i++) {
    const single = await PDFDocument.create();
    const [copied] = await single.copyPages(pdf, [i]);
    single.addPage(copied);
    const bytes = await single.save({ useObjectStreams: false });
    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
    hashes.push(hash);
  }

  return { pageCount, hashes };
}

export interface DiffResult {
  changedPages: number[];
  summary: string;
}

export function computeDiff(prev: PageHashes | null, next: PageHashes): DiffResult {
  if (!prev) {
    return {
      changedPages: Array.from({ length: next.pageCount }, (_, i) => i),
      summary: `Initial version (${next.pageCount} pages)`,
    };
  }

  const changed: number[] = [];
  const maxPages = Math.max(prev.pageCount, next.pageCount);
  for (let i = 0; i < maxPages; i++) {
    const a = prev.hashes[i];
    const b = next.hashes[i];
    if (a !== b) changed.push(i);
  }

  const parts: string[] = [];
  const modified = changed.filter((i) => i < prev.pageCount && i < next.pageCount);
  const added = next.pageCount - prev.pageCount;

  if (modified.length > 0) {
    parts.push(`Page${modified.length > 1 ? 's' : ''} ${modified.map((i) => i + 1).join(', ')} modified`);
  }
  if (added > 0) parts.push(`${added} page${added > 1 ? 's' : ''} added`);
  if (added < 0) parts.push(`${-added} page${-added < -1 ? 's' : ''} removed`);

  return {
    changedPages: changed,
    summary: parts.length > 0 ? parts.join('; ') : 'No content change',
  };
}
