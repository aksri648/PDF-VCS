import { create } from 'zustand';
import type { VersionMeta } from '../types';

export type Tool = 'select' | 'text' | 'highlight' | 'draw' | 'rect' | 'circle';

export interface Annotation {
  id: string;
  page: number;
  type: Tool;
  x: number;
  y: number;
  w?: number;
  h?: number;
  text?: string;
  color: string;
  path?: Array<{ x: number; y: number }>;
}

interface PdfState {
  documentId: string | null;
  currentPdfBytes: Uint8Array | null;
  pageCount: number;
  currentPage: number;
  zoom: number;
  tool: Tool;
  annotations: Annotation[];
  history: Annotation[][];
  future: Annotation[][];
  versions: VersionMeta[];
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';

  setDocumentId: (id: string | null) => void;
  setPdfBytes: (b: Uint8Array | null) => void;
  setPageCount: (n: number) => void;
  setCurrentPage: (n: number) => void;
  setZoom: (z: number) => void;
  setTool: (t: Tool) => void;
  addAnnotation: (a: Annotation) => void;
  setAnnotations: (a: Annotation[]) => void;
  undo: () => void;
  redo: () => void;
  setVersions: (v: VersionMeta[]) => void;
  prependVersion: (v: VersionMeta) => void;
  setSaveStatus: (s: PdfState['saveStatus']) => void;
}

export const usePdfStore = create<PdfState>((set, get) => ({
  documentId: null,
  currentPdfBytes: null,
  pageCount: 0,
  currentPage: 1,
  zoom: 1,
  tool: 'select',
  annotations: [],
  history: [],
  future: [],
  versions: [],
  saveStatus: 'idle',

  setDocumentId: (id) => set({ documentId: id }),
  setPdfBytes: (b) => set({ currentPdfBytes: b }),
  setPageCount: (n) => set({ pageCount: n }),
  setCurrentPage: (n) => set({ currentPage: n }),
  setZoom: (z) => set({ zoom: z }),
  setTool: (t) => set({ tool: t }),

  addAnnotation: (a) => {
    const { annotations, history } = get();
    set({
      history: [...history, annotations],
      future: [],
      annotations: [...annotations, a],
    });
  },

  setAnnotations: (a) => {
    const { annotations, history } = get();
    set({ history: [...history, annotations], future: [], annotations: a });
  },

  undo: () => {
    const { history, annotations, future } = get();
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    set({
      history: history.slice(0, -1),
      future: [annotations, ...future],
      annotations: prev,
    });
  },

  redo: () => {
    const { future, annotations, history } = get();
    if (future.length === 0) return;
    const [next, ...rest] = future;
    set({
      history: [...history, annotations],
      future: rest,
      annotations: next,
    });
  },

  setVersions: (v) => set({ versions: v }),
  prependVersion: (v) =>
    set((s) => ({
      versions: [v, ...s.versions.filter((x) => x._id !== v._id)],
    })),
  setSaveStatus: (s) => set({ saveStatus: s }),
}));
