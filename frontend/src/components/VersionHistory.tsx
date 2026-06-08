import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import { api } from '../api';
import { usePdfStore } from '../store/pdfStore';
import type { VersionMeta } from '../types';

interface Props {
  documentId: string;
  onPreview: (v: VersionMeta) => void;
  onRollback: (v: VersionMeta) => void;
  onOpenDiff: (v: VersionMeta) => void;
}

export function VersionHistory({ documentId, onPreview, onRollback, onOpenDiff }: Props) {
  const versions = usePdfStore((s) => s.versions);
  const setVersions = usePdfStore((s) => s.setVersions);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState('');

  const saveLabel = async (v: VersionMeta) => {
    const updated = await api.updateLabel(documentId, v._id, draftLabel);
    setVersions(versions.map((x) => (x._id === v._id ? updated : x)));
    setEditingId(null);
  };

  const download = async (v: VersionMeta) => {
    const buf = await api.getVersionPdf(documentId, v._id);
    const blob = new Blob([buf], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `v${v.versionNumber}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <aside className="w-80 border-l bg-white overflow-y-auto">
      <div className="p-3 border-b font-medium bg-slate-50">Version History</div>
      <ul>
        {versions.map((v) => (
          <li key={v._id} className="p-3 border-b hover:bg-slate-50">
            <div className="flex items-start gap-2">
              {v.thumbnail ? (
                <img src={v.thumbnail} alt="" className="w-12 h-16 border rounded object-cover" />
              ) : (
                <div className="w-12 h-16 border rounded bg-slate-100" />
              )}
              <div className="flex-1 min-w-0">
                {editingId === v._id ? (
                  <input
                    autoFocus
                    value={draftLabel}
                    onChange={(e) => setDraftLabel(e.target.value)}
                    onBlur={() => saveLabel(v)}
                    onKeyDown={(e) => e.key === 'Enter' && saveLabel(v)}
                    className="w-full text-sm border rounded px-1"
                  />
                ) : (
                  <button
                    onClick={() => {
                      setEditingId(v._id);
                      setDraftLabel(v.label);
                    }}
                    className="text-sm font-medium text-left truncate hover:underline w-full"
                  >
                    {v.label || `v${v.versionNumber}`}
                  </button>
                )}
                <div className="text-xs text-slate-500">
                  {formatDistanceToNow(new Date(v.createdAt), { addSuffix: true })}
                  {v.isAutoSave ? ' • autosave' : ''}
                </div>
                {v.changedPages.length > 0 && (
                  <div className="text-xs text-blue-700 mt-1">
                    Pages {v.changedPages.map((p) => p + 1).join(', ')} changed
                  </div>
                )}
                {v.diffSummary && <div className="text-xs text-slate-600 mt-1">{v.diffSummary}</div>}
                <div className="mt-2 flex flex-wrap gap-1">
                  <button
                    onClick={() => onPreview(v)}
                    className="text-xs px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200"
                  >
                    Preview
                  </button>
                  <button
                    onClick={() => onRollback(v)}
                    className="text-xs px-2 py-0.5 rounded bg-amber-100 hover:bg-amber-200"
                  >
                    Rollback
                  </button>
                  <button
                    onClick={() => download(v)}
                    className="text-xs px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200"
                  >
                    Download
                  </button>
                  <button
                    onClick={() => onOpenDiff(v)}
                    className="text-xs px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200"
                  >
                    Diff
                  </button>
                </div>
              </div>
            </div>
          </li>
        ))}
        {versions.length === 0 && (
          <li className="p-3 text-sm text-slate-400">No versions yet.</li>
        )}
      </ul>
    </aside>
  );
}
