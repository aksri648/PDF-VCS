import { usePdfStore, type Tool } from '../store/pdfStore';

const tools: { id: Tool; label: string }[] = [
  { id: 'select', label: 'Select' },
  { id: 'text', label: 'Text' },
  { id: 'highlight', label: 'Highlight' },
  { id: 'draw', label: 'Draw' },
  { id: 'rect', label: 'Rect' },
  { id: 'circle', label: 'Circle' },
];

interface Props {
  onManualSave: () => void;
}

export function Toolbar({ onManualSave }: Props) {
  const tool = usePdfStore((s) => s.tool);
  const setTool = usePdfStore((s) => s.setTool);
  const undo = usePdfStore((s) => s.undo);
  const redo = usePdfStore((s) => s.redo);
  const zoom = usePdfStore((s) => s.zoom);
  const setZoom = usePdfStore((s) => s.setZoom);
  const saveStatus = usePdfStore((s) => s.saveStatus);

  const statusText =
    saveStatus === 'saving'
      ? 'Saving…'
      : saveStatus === 'saved'
      ? 'Saved ✓'
      : saveStatus === 'error'
      ? 'Save error'
      : 'Idle';

  return (
    <div className="flex items-center gap-2 bg-white border-b px-3 py-2 shadow-sm">
      {tools.map((t) => (
        <button
          key={t.id}
          onClick={() => setTool(t.id)}
          className={`px-3 py-1 rounded text-sm ${
            tool === t.id ? 'bg-blue-600 text-white' : 'bg-slate-100 hover:bg-slate-200'
          }`}
        >
          {t.label}
        </button>
      ))}
      <div className="w-px h-6 bg-slate-200 mx-1" />
      <button onClick={undo} className="px-3 py-1 rounded text-sm bg-slate-100 hover:bg-slate-200">
        Undo
      </button>
      <button onClick={redo} className="px-3 py-1 rounded text-sm bg-slate-100 hover:bg-slate-200">
        Redo
      </button>
      <div className="w-px h-6 bg-slate-200 mx-1" />
      <button
        onClick={() => setZoom(Math.max(0.4, zoom - 0.1))}
        className="px-3 py-1 rounded text-sm bg-slate-100 hover:bg-slate-200"
      >
        Zoom −
      </button>
      <span className="text-sm w-12 text-center">{Math.round(zoom * 100)}%</span>
      <button
        onClick={() => setZoom(Math.min(3, zoom + 0.1))}
        className="px-3 py-1 rounded text-sm bg-slate-100 hover:bg-slate-200"
      >
        Zoom +
      </button>
      <button
        onClick={() => setZoom(1)}
        className="px-3 py-1 rounded text-sm bg-slate-100 hover:bg-slate-200"
      >
        Fit
      </button>
      <div className="flex-1" />
      <span
        className={`text-sm px-2 ${
          saveStatus === 'saved'
            ? 'text-green-700'
            : saveStatus === 'saving'
            ? 'text-amber-700'
            : saveStatus === 'error'
            ? 'text-red-700'
            : 'text-slate-500'
        }`}
      >
        {statusText}
      </span>
      <button
        onClick={onManualSave}
        className="px-3 py-1 rounded text-sm bg-green-600 text-white hover:bg-green-700"
      >
        Manual Save
      </button>
    </div>
  );
}
