import { useEffect, useRef, useState } from 'react';
import {
  getConfig,
  restartBackend,
  saveConfig,
  subscribeBackendLog,
  type BackendLog,
} from '../tauri';

interface Props {
  onClose: () => void;
  onSaved?: () => void;
}

export function MongoSettingsModal({ onClose, onSaved }: Props) {
  const [uri, setUri] = useState('');
  const [original, setOriginal] = useState('');
  const [showUri, setShowUri] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [logs, setLogs] = useState<BackendLog[]>([]);
  const logsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void getConfig().then((cfg) => {
      setUri(cfg.mongoUri ?? '');
      setOriginal(cfg.mongoUri ?? '');
    });
    let unlisten: (() => void) | undefined;
    void subscribeBackendLog((log) => {
      setLogs((prev) => [...prev.slice(-49), log]);
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = uri.trim();
    if (!trimmed) {
      setError('Connection string cannot be empty.');
      return;
    }
    if (trimmed === original) {
      onClose();
      return;
    }
    setError(undefined);
    setLogs([]);
    setSubmitting(true);
    try {
      await saveConfig({ mongoUri: trimmed });
      await restartBackend(trimmed);
      onSaved?.();
      onClose();
    } catch (e) {
      setError(typeof e === 'string' ? e : (e as Error)?.message ?? 'Failed to connect.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-xl">
        <div className="px-5 py-3 border-b flex items-center">
          <h3 className="font-medium">MongoDB connection</h3>
          <div className="flex-1" />
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 text-sm disabled:opacity-50"
          >
            Close
          </button>
        </div>

        <form onSubmit={submit} className="p-5">
          <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="mongo-uri-modal">
            Connection string
          </label>
          <div className="flex items-stretch gap-2 mb-4">
            <input
              id="mongo-uri-modal"
              type={showUri ? 'text' : 'password'}
              value={uri}
              onChange={(e) => setUri(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              disabled={submitting}
              className="flex-1 px-3 py-2 border rounded font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => setShowUri((v) => !v)}
              className="px-3 py-2 text-sm rounded bg-slate-100 hover:bg-slate-200"
              disabled={submitting}
            >
              {showUri ? 'Hide' : 'Show'}
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-sm text-red-700 whitespace-pre-wrap">
              {error}
            </div>
          )}

          <p className="text-xs text-slate-500 mb-4">
            Saving will reconnect the backend. Any in-flight uploads will fail.
          </p>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting || !uri.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Reconnecting…' : 'Save & reconnect'}
            </button>
          </div>

          {(submitting || logs.length > 0) && (
            <div
              ref={logsRef}
              className="mt-4 max-h-32 overflow-auto text-xs font-mono bg-slate-900 text-slate-100 rounded p-3"
            >
              {logs.map((l, i) => (
                <div key={i} className={l.stream === 'stderr' ? 'text-red-300' : ''}>
                  {l.line.trimEnd()}
                </div>
              ))}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
