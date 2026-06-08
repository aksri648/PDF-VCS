import { Router } from 'express';
import multer from 'multer';
import {
  uploadPdf,
  listDocuments,
  getDocument,
  deleteDocument,
} from '../controllers/pdfController';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

const router = Router();

router.post('/upload', upload.single('file'), uploadPdf);
router.get('/', listDocuments);
router.get('/:id', getDocument);
router.delete('/:id', deleteDocument);

export default router;
