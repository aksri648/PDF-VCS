import { Schema, model, Types, Document as MongoDocument } from 'mongoose';

export interface IVersion extends MongoDocument {
  documentId: Types.ObjectId;
  versionNumber: number;
  label: string;
  pdfData: Buffer;
  diffSummary: string;
  changedPages: number[];
  isAutoSave: boolean;
  thumbnail: string;
  createdAt: Date;
}

const VersionSchema = new Schema<IVersion>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
    versionNumber: { type: Number, required: true },
    label: { type: String, default: '' },
    pdfData: { type: Buffer, required: true },
    diffSummary: { type: String, default: '' },
    changedPages: { type: [Number], default: [] },
    isAutoSave: { type: Boolean, default: false },
    thumbnail: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

VersionSchema.index({ documentId: 1, versionNumber: -1 });

export const VersionModel = model<IVersion>('Version', VersionSchema);
