export interface DocumentMeta {
  _id: string;
  name: string;
  currentVersionId: string | null;
  metadata: {
    pageCount: number;
    fileSize: number;
    author: string;
  };
  createdAt: string;
  updatedAt: string;
  versionCount?: number;
}

export interface VersionMeta {
  _id: string;
  documentId: string;
  versionNumber: number;
  label: string;
  diffSummary: string;
  changedPages: number[];
  isAutoSave: boolean;
  thumbnail: string;
  createdAt: string;
}
