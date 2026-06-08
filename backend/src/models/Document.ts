import { Schema, model, Types, Document as MongoDocument } from 'mongoose';

export interface IDocument extends MongoDocument {
  name: string;
  currentVersionId: Types.ObjectId | null;
  metadata: {
    pageCount: number;
    fileSize: number;
    author: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const DocumentSchema = new Schema<IDocument>(
  {
    name: { type: String, required: true },
    currentVersionId: { type: Schema.Types.ObjectId, ref: 'Version', default: null },
    metadata: {
      pageCount: { type: Number, default: 0 },
      fileSize: { type: Number, default: 0 },
      author: { type: String, default: 'anonymous' },
    },
  },
  { timestamps: true }
);

export const DocumentModel = model<IDocument>('Document', DocumentSchema);
