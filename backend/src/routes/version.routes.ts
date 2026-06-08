import { Router } from 'express';
import multer from 'multer';
import {
  listVersions,
  getVersion,
  saveVersion,
  rollbackVersion,
  deleteVersion,
  updateVersionLabel,
} from '../controllers/versionController';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

const router = Router();

router.get('/:documentId', listVersions);
router.get('/:documentId/:versionId', getVersion);
router.post('/:documentId', upload.single('file'), saveVersion);
router.post('/:documentId/rollback/:versionId', rollbackVersion);
router.delete('/:documentId/:versionId', deleteVersion);
router.patch('/:documentId/:versionId/label', updateVersionLabel);

export default router;
