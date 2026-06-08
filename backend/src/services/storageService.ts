import { PDFDocument } from 'pdf-lib';
import { DocumentModel } from '../models/Document';
import { VersionModel, IVersion } from '../models/Version';
import { hashPagesOfPdf, computeDiff, PageHashes } from './diffService';
import { Types } from 'mongoose';

export interface CreateVersionInput {
  documentId: Types.ObjectId | string;
  pdfData: Buffer;
  label?: string;
  isAutoSave?: boolean;
  thumbnail?: string;
}

async function getPdfMetadata(pdfBytes: Buffer) {
  const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  return {
    pageCount: pdf.getPageCount(),
    fileSize: pdfBytes.length,
  };
}

export async function createDocumentWithFirstVersion(opts: {
  name: string;
  pdfData: Buffer;
  author?: string;
  thumbnail?: string;
}) {
  const { name, pdfData, author = 'anonymous', thumbnail = '' } = opts;
  const meta = await getPdfMetadata(pdfData);

  const doc = await DocumentModel.create({
    name,
    metadata: { ...meta, author },
  });

  const hashes = await hashPagesOfPdf(pdfData);
  const diff = computeDiff(null, hashes);

  const version = await VersionModel.create({
    documentId: doc._id,
    versionNumber: 1,
    label: 'v1 — original',
    pdfData,
    diffSummary: diff.summary,
    changedPages: diff.changedPages,
    isAutoSave: false,
    thumbnail,
  });

  doc.currentVersionId = version._id as Types.ObjectId;
  await doc.save();

  return { document: doc, version };
}

export async function appendVersion(input: CreateVersionInput): Promise<IVersion> {
  const { documentId, pdfData, label = '', isAutoSave = true, thumbnail = '' } = input;

  const doc = await DocumentModel.findById(documentId);
  if (!doc) throw new Error('Document not found');

  const latest = await VersionModel.findOne({ documentId }).sort({ versionNumber: -1 });
  const nextNumber = (latest?.versionNumber ?? 0) + 1;

  let prevHashes: PageHashes | null = null;
  if (latest) prevHashes = await hashPagesOfPdf(latest.pdfData);
  const nextHashes = await hashPagesOfPdf(pdfData);
  const diff = computeDiff(prevHashes, nextHashes);

  const version = await VersionModel.create({
    documentId: doc._id,
    versionNumber: nextNumber,
    label: label || `v${nextNumber}${isAutoSave ? ' — autosave' : ''}`,
    pdfData,
    diffSummary: diff.summary,
    changedPages: diff.changedPages,
    isAutoSave,
    thumbnail,
  });

  const meta = await getPdfMetadata(pdfData);
  doc.metadata.pageCount = meta.pageCount;
  doc.metadata.fileSize = meta.fileSize;
  doc.currentVersionId = version._id as Types.ObjectId;
  await doc.save();

  return version;
}

export async function rollbackToVersion(documentId: string, targetVersionId: string) {
  const target = await VersionModel.findOne({ _id: targetVersionId, documentId });
  if (!target) throw new Error('Target version not found');

  const latest = await VersionModel.findOne({ documentId }).sort({ versionNumber: -1 });
  const nextNumber = (latest?.versionNumber ?? 0) + 1;

  const rolledBack = await VersionModel.create({
    documentId: target.documentId,
    versionNumber: nextNumber,
    label: `v${nextNumber} — rollback to v${target.versionNumber}`,
    pdfData: target.pdfData,
    diffSummary: `Rolled back to v${target.versionNumber}`,
    changedPages: target.changedPages,
    isAutoSave: false,
    thumbnail: target.thumbnail,
  });

  await DocumentModel.findByIdAndUpdate(documentId, { currentVersionId: rolledBack._id });
  return rolledBack;
}
