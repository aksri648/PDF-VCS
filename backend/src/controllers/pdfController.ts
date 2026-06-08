import { Request, Response } from 'express';
import { DocumentModel } from '../models/Document';
import { VersionModel } from '../models/Version';
import { createDocumentWithFirstVersion } from '../services/storageService';

export async function uploadPdf(req: Request, res: Response) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'Only PDF files are allowed' });
    }

    const name = req.body.name || req.file.originalname;
    const thumbnail = req.body.thumbnail || '';
    const author = req.body.author || 'anonymous';

    const { document, version } = await createDocumentWithFirstVersion({
      name,
      pdfData: req.file.buffer,
      author,
      thumbnail,
    });

    res.status(201).json({
      document,
      versionId: version._id,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    res.status(500).json({ error: message });
  }
}

export async function listDocuments(_req: Request, res: Response) {
  const docs = await DocumentModel.find().sort({ updatedAt: -1 }).lean();
  const withCounts = await Promise.all(
    docs.map(async (d) => ({
      ...d,
      versionCount: await VersionModel.countDocuments({ documentId: d._id }),
    }))
  );
  res.json(withCounts);
}

export async function getDocument(req: Request, res: Response) {
  const doc = await DocumentModel.findById(req.params.id).lean();
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  const versionCount = await VersionModel.countDocuments({ documentId: doc._id });
  res.json({ ...doc, versionCount });
}

export async function deleteDocument(req: Request, res: Response) {
  const { id } = req.params;
  await VersionModel.deleteMany({ documentId: id });
  await DocumentModel.findByIdAndDelete(id);
  res.json({ ok: true });
}
