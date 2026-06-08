import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { api } from '../api';
import { generateThumbnail } from '../pdfEdit';

interface Props {
  onUploaded: (documentId: string) => void;
}

export function FileUploader({ onUploaded }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file || file.type !== 'application/pdf') {
        setError('Only PDF files are allowed');
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const buf = new Uint8Array(await file.arrayBuffer());
        const thumb = await generateThumbnail(buf).catch(() => '');
        const { document } = await api.uploadPdf(file, thumb);
        onUploaded(document._id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setBusy(false);
      }
    },
    [onUploaded]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${
        isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400'
      }`}
    >
      <input {...getInputProps()} />
      {busy ? (
        <p className="text-slate-600">Uploading…</p>
      ) : (
        <p className="text-slate-600">
          {isDragActive ? 'Drop the PDF here…' : 'Drag a PDF here, or click to select'}
        </p>
      )}
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
    </div>
  );
}
