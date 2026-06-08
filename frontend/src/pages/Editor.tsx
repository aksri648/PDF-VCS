import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { Toolbar } from '../components/Toolbar';
import { PDFEditor } from '../components/PDFEditor';
import { VersionHistory } from '../components/VersionHistory';
import { PreviewModal } from '../components/PreviewModal';
import { DiffViewer } from '../components/DiffViewer';
import { useAutoSave } from '../hooks/useAutoSave';
import { useSocket } from '../hooks/useSocket';
import { usePdfStore } from '../store/pdfStore';
import { embedAnnotations, generateThumbnail } from '../pdfEdit';
import type { VersionMeta } from '../types';

export function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const documentId = id ?? null;

  const annotations = usePdfStore((s) => s.annotations);
  const pdfBytes = usePdfStore((s) => s.currentPdfBytes);
  const pageCount = usePdfStore((s) => s.pageCount);
  const currentPage = usePdfStore((s) => s.currentPage);

  const setDocumentId = usePdfStore((s) => s.setDocumentId);
  const setPdfBytes = usePdfStore((s) => s.setPdfBytes);
  const setVersions = usePdfStore((s) => s.setVersions);
  const setCurrentPage = usePdfStore((s) => s.setCurrentPage);
  const prependVersion = usePdfStore((s) => s.prependVersion);
  const setSaveStatus = usePdfStore((s) => s.setSaveStatus);
  const versions = usePdfStore((s) => s.versions);

  const [previewVersion, setPreviewVersion] = useState<VersionMeta | null>(null);
  const [diffRight, setDiffRight] = useState<VersionMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId) return;
    setDocumentId(documentId);
    (async () => {
      const doc = await api.getDocument(documentId);
      if (doc.currentVersionId) {
        const buf = await api.getVersionPdf(documentId, doc.currentVersionId);
        setPdfBytes(new Uint8Array(buf));
      }
      const vers = await api.listVersions(documentId);
      setVersions(vers);
    })();
    return () => {
      setDocumentId(null);
      setPdfBytes(null);
      setVersions([]);
    };
  }, [documentId, setDocumentId, setPdfBytes, setVersions]);

  useSocket(documentId, {
    onVersionSaved: (v) => {
      prependVersion(v);
      setSaveStatus('saved');
    },
    onSaveError: (msg) => {
      setError(msg);
      setSaveStatus('error');
    },
  });

  const saveCurrent = useCallback(
    async (manual: boolean) => {
      if (!documentId || !pdfBytes) return;
      setSaveStatus('saving');
      try {
        const merged = await embedAnnotations(pdfBytes, annotations);
        const thumb = await generateThumbnail(merged).catch(() => '');
        const blob = new Blob([merged as BlobPart], { type: 'application/pdf' });
        const version = await api.saveVersion(documentId, blob, {
          isAutoSave: !manual,
          thumbnail: thumb,
          label: manual ? `manual save` : undefined,
        });
        prependVersion(version);
        setSaveStatus('saved');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed');
        setSaveStatus('error');
      }
    },
    [documentId, pdfBytes, annotations, prependVersion, setSaveStatus]
  );

  useAutoSave(annotations, !!pdfBytes && !!documentId && annotations.length > 0, () => saveCurrent(false), 2000);

  const onRollback = async (v: VersionMeta) => {
    if (!documentId) return;
    if (!confirm(`Rollback to ${v.label || 'v' + v.versionNumber}?`)) return;
    await api.rollback(documentId, v._id);
    const fresh = await api.listVersions(documentId);
    setVersions(fresh);
    const top = fresh[0];
    if (top) {
      const buf = await api.getVersionPdf(documentId, top._id);
      setPdfBytes(new Uint8Array(buf));
    }
  };

  if (!documentId) {
    return <div className="p-6">Document not found.</div>;
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="px-3 py-1 bg-slate-800 text-white text-sm flex items-center">
        <Link to="/" className="hover:underline">
          ← Documents
        </Link>
        {error && <span className="ml-4 text-red-300">{error}</span>}
      </div>
      <Toolbar onManualSave={() => saveCurrent(true)} />
      <div className="flex-1 flex overflow-hidden">
        <PDFEditor />
        <VersionHistory
          documentId={documentId}
          onPreview={(v) => setPreviewVersion(v)}
          onRollback={onRollback}
          onOpenDiff={(v) => setDiffRight(v)}
        />
      </div>
      <div className="bg-slate-100 border-t px-3 py-1 text-sm flex items-center gap-3">
        <button
          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
          className="px-2 py-0.5 rounded bg-white border hover:bg-slate-50"
        >
          {'< Prev'}
        </button>
        <span>
          Page {currentPage} / {pageCount}
        </span>
        <button
          onClick={() => setCurrentPage(Math.min(pageCount, currentPage + 1))}
          className="px-2 py-0.5 rounded bg-white border hover:bg-slate-50"
        >
          {'Next >'}
        </button>
      </div>
      {previewVersion && (
        <PreviewModal
          documentId={documentId}
          version={previewVersion}
          onClose={() => setPreviewVersion(null)}
        />
      )}
      {diffRight && (() => {
        const idx = versions.findIndex((v) => v._id === diffRight._id);
        const left = versions[idx + 1] ?? versions[idx];
        return (
          <DiffViewer
            documentId={documentId}
            left={left}
            right={diffRight}
            onClose={() => setDiffRight(null)}
          />
        );
      })()}
    </div>
  );
}
