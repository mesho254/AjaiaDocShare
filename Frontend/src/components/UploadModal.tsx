import React, { useRef, useState } from 'react';
import { Upload, X, FileText, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface UploadModalProps {
  isOpen: boolean;
  mode: 'create' | 'extract';
  onClose: () => void;
  onUpload: (file: File, customTitle?: string) => Promise<void>;
}

const SUPPORTED_EXT = ['.txt', '.md', '.docx'];
const MAX_BYTES = 5 * 1024 * 1024;

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  mode,
  onClose,
  onUpload
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  function validateAndPickFile(file: File | undefined) {
    setError(null);
    if (!file) return;

    const lower = file.name.toLowerCase();
    const validExt = SUPPORTED_EXT.some((ext) => lower.endsWith(ext));
    if (!validExt) {
      setError(
        `Unsupported file format "${file.name}". Please upload a .txt, .md, or .docx file.`
      );
      setSelectedFile(null);
      return;
    }

    if (file.size > MAX_BYTES) {
      setError('File exceeds the 5 MB size limit.');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    if (!customTitle) {
      const inferred = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
      setCustomTitle(inferred);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a file first.');
      return;
    }

    setUploading(true);
    setError(null);
    try {
      await onUpload(selectedFile, customTitle.trim() || undefined);
      setSelectedFile(null);
      setCustomTitle('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'File upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {mode === 'create'
                  ? 'Upload File as New Document'
                  : 'Import File into Active Document'}
              </h2>
              <p className="text-xs text-slate-500">
                Supported formats: <strong>.txt</strong>, <strong>.md</strong>, <strong>.docx</strong> (max 5 MB)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              validateAndPickFile(e.dataTransfer.files?.[0]);
            }}
            className="cursor-pointer rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:border-indigo-400 hover:bg-indigo-50/40"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.docx"
              className="hidden"
              onChange={(e) => validateAndPickFile(e.target.files?.[0])}
            />
            <FileText className="mx-auto h-8 w-8 text-indigo-500" />
            <p className="mt-2 text-sm font-semibold text-slate-800">
              Click to choose a file or drag and drop
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Converts Markdown, Plain Text, or Word (.docx) into structured rich text
            </p>
          </div>

          {selectedFile && (
            <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-900">
              <div className="flex items-center gap-2 truncate">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span className="truncate font-semibold">{selectedFile.name}</span>
                <span className="text-emerald-700">
                  ({Math.max(1, Math.round(selectedFile.size / 1024))} KB)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                className="ml-2 text-emerald-700 hover:underline"
              >
                Remove
              </button>
            </div>
          )}

          {mode === 'create' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Document Title
              </label>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Inferred from filename..."
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedFile || uploading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Converting...</span>
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5" />
                  <span>{mode === 'create' ? 'Create Document' : 'Import Content'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
