import { useEffect, useRef, useState } from 'react';
import { open as openExternal } from '@tauri-apps/plugin-shell';
import { saveConfig, startBackend, subscribeBackendLog, type BackendLog } from '../tauri';

interface Props {
  initialUri?: string;
  initialError?: string;
  onConnected: () => void;
}

const LOCAL_URI = 'mongodb://localhost:27017/pdfvcs';

export function Setup({ initialUri = '', initialError, onConnected }: Props) {
  const [uri, setUri] = useState(initialUri);
  const [showUri, setShowUri] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(initialError);
  const [logs, setLogs] = useState<BackendLog[]>([]);
  const logsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
      setError('Paste your MongoDB connection string to continue.');
      return;
    }
    setError(undefined);
    setLogs([]);
    setSubmitting(true);
    try {
      await saveConfig({ mongoUri: trimmed });
      await startBackend(trimmed);
      onConnected();
    } catch (e) {
      setError(typeof e === 'string' ? e : (e as Error)?.message ?? 'Failed to connect.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-xl bg-white rounded-xl shadow-sm border p-8">
        <h1 className="text-2xl font-semibold mb-2">Connect your database</h1>
        <p className="text-sm text-slate-600 mb-6">
          PDF Version Control stores your documents in a MongoDB database that you own. Paste a
          connection string to get started — it stays on this machine.
        </p>

        <form onSubmit={submit}>
          <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="mongo-uri">
            MongoDB connection string
          </label>
          <div className="flex items-stretch gap-2 mb-2">
            <input
              id="mongo-uri"
              type={showUri ? 'text' : 'password'}
              value={uri}
              onChange={(e) => setUri(e.target.value)}
              placeholder="mongodb+srv://user:pass@cluster.mongodb.net/pdfvcs"
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

          <div className="flex items-center gap-3 text-xs text-slate-500 mb-6">
            <button
              type="button"
              onClick={() => setUri(LOCAL_URI)}
              className="underline hover:text-slate-700"
              disabled={submitting}
            >
              Use local mongod
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => {
                void openExternal('https://www.mongodb.com/cloud/atlas/register').catch(() => {});
              }}
              className="underline hover:text-slate-700"
              disabled={submitting}
            >
              Get a free Atlas cluster
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-sm text-red-700 whitespace-pre-wrap">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !uri.trim()}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Testing connection…' : 'Test connection & save'}
          </button>
        </form>

        {(submitting || logs.length > 0) && (
          <div
            ref={logsRef}
            className="mt-6 max-h-40 overflow-auto text-xs font-mono bg-slate-900 text-slate-100 rounded p-3"
          >
            {logs.map((l, i) => (
              <div key={i} className={l.stream === 'stderr' ? 'text-red-300' : ''}>
                {l.line.trimEnd()}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
