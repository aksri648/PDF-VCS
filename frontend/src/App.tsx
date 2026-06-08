import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { EditorPage } from './pages/Editor';
import { Setup } from './pages/Setup';
import { getConfig, isTauri, startBackend } from './tauri';

type GateState =
  | { kind: 'loading' }
  | { kind: 'setup'; initialUri?: string; initialError?: string }
  | { kind: 'starting' }
  | { kind: 'ready' };

function BackendGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GateState>({ kind: 'loading' });

  useEffect(() => {
    if (!isTauri()) {
      setState({ kind: 'ready' });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const cfg = await getConfig();
        if (cancelled) return;
        if (!cfg.mongoUri) {
          setState({ kind: 'setup' });
          return;
        }
        setState({ kind: 'starting' });
        try {
          await startBackend(cfg.mongoUri);
          if (!cancelled) setState({ kind: 'ready' });
        } catch (e) {
          if (cancelled) return;
          setState({
            kind: 'setup',
            initialUri: cfg.mongoUri,
            initialError: typeof e === 'string' ? e : (e as Error)?.message ?? 'Connection failed.',
          });
        }
      } catch (e) {
        if (!cancelled) {
          setState({
            kind: 'setup',
            initialError: typeof e === 'string' ? e : (e as Error)?.message ?? 'Setup failed.',
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === 'loading') {
    return <FullScreenMessage title="Starting…" />;
  }
  if (state.kind === 'setup') {
    return (
      <Setup
        initialUri={state.initialUri}
        initialError={state.initialError}
        onConnected={() => setState({ kind: 'ready' })}
      />
    );
  }
  if (state.kind === 'starting') {
    return <FullScreenMessage title="Connecting to your database…" />;
  }
  return <>{children}</>;
}

function FullScreenMessage({ title }: { title: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-slate-600">{title}</div>
    </div>
  );
}

export function App() {
  return (
    <BackendGate>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/editor/:id" element={<EditorPage />} />
        </Routes>
      </BrowserRouter>
    </BackendGate>
  );
}
