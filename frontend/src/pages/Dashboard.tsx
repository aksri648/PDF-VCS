import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { FileUploader } from '../components/FileUploader';
import { MongoSettingsModal } from '../components/MongoSettingsModal';
import type { DocumentMeta } from '../types';
import { formatDistanceToNow } from 'date-fns';

export function Dashboard() {
  const [docs, setDocs] = useState<DocumentMeta[]>([]);
  const [showUploader, setShowUploader] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const navigate = useNavigate();

  const refresh = async () => setDocs(await api.listDocuments());

  useEffect(() => {
    void refresh();
  }, []);

  const onDelete = async (id: string) => {
    if (!confirm('Delete this document and all its versions?')) return;
    await api.deleteDocument(id);
    await refresh();
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">PDF Version Control</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(true)}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
          >
            Settings
          </button>
          <button
            onClick={() => setShowUploader((v) => !v)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {showUploader ? 'Cancel' : 'Upload New PDF'}
          </button>
        </div>
      </header>

      {showUploader && (
        <div className="mb-6">
          <FileUploader
            onUploaded={(id) => {
              setShowUploader(false);
              navigate(`/editor/${id}`);
            }}
          />
        </div>
      )}

      {docs.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          No documents yet. Upload a PDF to get started.
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {docs.map((d) => (
            <li key={d._id} className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <Link to={`/editor/${d._id}`} className="block">
                <div className="aspect-[3/4] bg-slate-100 flex items-center justify-center">
                  <span className="text-slate-300">PDF</span>
                </div>
              </Link>
              <div className="p-3">
                <div className="font-medium truncate">{d.name}</div>
                <div className="text-xs text-slate-500">
                  {d.metadata.pageCount} pages • {(d.metadata.fileSize / 1024).toFixed(1)} KB
                </div>
                <div className="text-xs text-slate-500">
                  Updated {formatDistanceToNow(new Date(d.updatedAt), { addSuffix: true })}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">
                    {d.versionCount ?? 0} versions
                  </span>
                  <div className="flex-1" />
                  <Link
                    to={`/editor/${d._id}`}
                    className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Open
                  </Link>
                  <button
                    onClick={() => onDelete(d._id)}
                    className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showSettings && (
        <MongoSettingsModal
          onClose={() => setShowSettings(false)}
          onSaved={() => void refresh()}
        />
      )}
    </div>
  );
}
