import type { DocumentMeta, VersionMeta } from './types';

const API_BASE = '/api';

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}

export const api = {
  async listDocuments(): Promise<DocumentMeta[]> {
    return jsonOrThrow(await fetch(`${API_BASE}/pdf`));
  },

  async getDocument(id: string): Promise<DocumentMeta> {
    return jsonOrThrow(await fetch(`${API_BASE}/pdf/${id}`));
  },

  async uploadPdf(file: File, thumbnail = ''): Promise<{ document: DocumentMeta; versionId: string }> {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('name', file.name);
    if (thumbnail) fd.append('thumbnail', thumbnail);
    return jsonOrThrow(await fetch(`${API_BASE}/pdf/upload`, { method: 'POST', body: fd }));
  },

  async deleteDocument(id: string): Promise<void> {
    await fetch(`${API_BASE}/pdf/${id}`, { method: 'DELETE' });
  },

  async listVersions(documentId: string): Promise<VersionMeta[]> {
    return jsonOrThrow(await fetch(`${API_BASE}/versions/${documentId}`));
  },

  async getVersionPdf(documentId: string, versionId: string): Promise<ArrayBuffer> {
    const res = await fetch(`${API_BASE}/versions/${documentId}/${versionId}`);
    if (!res.ok) throw new Error('Failed to load version');
    return res.arrayBuffer();
  },

  async saveVersion(
    documentId: string,
    pdfBlob: Blob,
    opts: { label?: string; isAutoSave?: boolean; thumbnail?: string } = {}
  ): Promise<VersionMeta> {
    const fd = new FormData();
    fd.append('file', pdfBlob, 'doc.pdf');
    if (opts.label) fd.append('label', opts.label);
    if (opts.isAutoSave !== undefined) fd.append('isAutoSave', String(opts.isAutoSave));
    if (opts.thumbnail) fd.append('thumbnail', opts.thumbnail);
    return jsonOrThrow(await fetch(`${API_BASE}/versions/${documentId}`, { method: 'POST', body: fd }));
  },

  async rollback(documentId: string, versionId: string): Promise<VersionMeta> {
    return jsonOrThrow(
      await fetch(`${API_BASE}/versions/${documentId}/rollback/${versionId}`, { method: 'POST' })
    );
  },

  async updateLabel(documentId: string, versionId: string, label: string): Promise<VersionMeta> {
    return jsonOrThrow(
      await fetch(`${API_BASE}/versions/${documentId}/${versionId}/label`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      })
    );
  },

  async deleteVersion(documentId: string, versionId: string): Promise<void> {
    await fetch(`${API_BASE}/versions/${documentId}/${versionId}`, { method: 'DELETE' });
  },
};
