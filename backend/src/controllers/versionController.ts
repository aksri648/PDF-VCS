import { Request, Response } from 'express';
import { VersionModel } from '../models/Version';
import { appendVersion, rollbackToVersion } from '../services/storageService';

export async function listVersions(req: Request, res: Response) {
  const { documentId } = req.params;
  const versions = await VersionModel.find({ documentId })
    .select('-pdfData')
    .sort({ versionNumber: -1 })
    .lean();
  res.json(versions);
}

export async function getVersion(req: Request, res: Response) {
  const { documentId, versionId } = req.params;
  const version = await VersionModel.findOne({ _id: versionId, documentId });
  if (!version) return res.status(404).json({ error: 'Version not found' });

  if (req.query.format === 'json') {
    const { pdfData: _omit, ...rest } = version.toObject();
    return res.json(rest);
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="v${version.versionNumber}.pdf"`);
  res.send(version.pdfData);
}

export async function saveVersion(req: Request, res: Response) {
  try {
    const { documentId } = req.params;
    const pdfData = req.file?.buffer;
    if (!pdfData) return res.status(400).json({ error: 'No PDF data' });

    const label = req.body.label || '';
    const isAutoSave = req.body.isAutoSave === 'true' || req.body.isAutoSave === true;
    const thumbnail = req.body.thumbnail || '';

    const version = await appendVersion({ documentId, pdfData, label, isAutoSave, thumbnail });
    const { pdfData: _omit, ...meta } = version.toObject();
    res.status(201).json(meta);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Save failed';
    res.status(500).json({ error: message });
  }
}

export async function rollbackVersion(req: Request, res: Response) {
  try {
    const { documentId, versionId } = req.params;
    const newVersion = await rollbackToVersion(documentId, versionId);
    const { pdfData: _omit, ...meta } = newVersion.toObject();
    res.json(meta);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Rollback failed';
    res.status(500).json({ error: message });
  }
}

export async function deleteVersion(req: Request, res: Response) {
  const { documentId, versionId } = req.params;
  await VersionModel.findOneAndDelete({ _id: versionId, documentId });
  res.json({ ok: true });
}

export async function updateVersionLabel(req: Request, res: Response) {
  const { documentId, versionId } = req.params;
  const { label } = req.body;
  const updated = await VersionModel.findOneAndUpdate(
    { _id: versionId, documentId },
    { label },
    { new: true }
  ).select('-pdfData');
  if (!updated) return res.status(404).json({ error: 'Version not found' });
  res.json(updated);
}
