import React, { useEffect, useState } from 'react';
import {
  History,
  X,
  RotateCcw,
  Plus,
  Clock,
  CheckCircle2,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { api, DocumentItem, DocumentVersion } from '../api/client';

interface VersionHistoryModalProps {
  isOpen: boolean;
  activeUserId: string;
  document: DocumentItem;
  readOnly: boolean;
  onClose: () => void;
  onRestored: (restoredDoc: DocumentItem) => void;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  isOpen,
  activeUserId,
  document: doc,
  readOnly,
  onClose,
  onRestored
}) => {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [selectedVersion, setSelectedVersion] =
    useState<DocumentVersion | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [snapshotSummary, setSnapshotSummary] = useState<string>('');
  const [savingSnapshot, setSavingSnapshot] = useState<boolean>(false);
  const [restoring, setRestoring] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    void loadVersions();
  }, [isOpen, doc.id, activeUserId]);

  async function loadVersions() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listVersions(activeUserId, doc.id);
      setVersions(res.versions);
      if (res.versions.length > 0) {
        setSelectedVersion(res.versions[0]);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not load version history'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSnapshot(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    setSavingSnapshot(true);
    setError(null);
    try {
      const res = await api.createVersion(
        activeUserId,
        doc.id,
        snapshotSummary.trim() || undefined
      );
      setVersions(res.versions);
      if (res.versions.length > 0) {
        setSelectedVersion(res.versions[0]);
      }
      setSnapshotSummary('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save version snapshot'
      );
    } finally {
      setSavingSnapshot(false);
    }
  }

  async function handleRestoreVersion(version: DocumentVersion) {
    if (readOnly) return;
    setRestoring(true);
    setError(null);
    try {
      const res = await api.restoreVersion(activeUserId, doc.id, version.id);
      onRestored(res.document);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to restore version'
      );
    } finally {
      setRestoring(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="flex h-[82vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Document Version History
              </h2>
              <p className="text-xs text-slate-500">
                Inspect earlier snapshots of &ldquo;{doc.title}&rdquo; or
                restore a previous version
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

        {error && (
          <div className="mx-6 mt-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs text-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Main Split Body */}
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Left Column: Snapshot Creator & Timeline List */}
          <div className="flex w-full flex-col border-b border-slate-200 bg-slate-50/70 md:w-80 md:border-b-0 md:border-r">
            {!readOnly && (
              <form
                onSubmit={handleCreateSnapshot}
                className="border-b border-slate-200 bg-white p-3.5"
              >
                <label className="block text-[11px] font-semibold text-slate-600">
                  Save Named Checkpoint
                </label>
                <div className="mt-1.5 flex gap-1.5">
                  <input
                    type="text"
                    value={snapshotSummary}
                    onChange={(e) => setSnapshotSummary(e.target.value)}
                    placeholder="e.g. Ready for design review..."
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={savingSnapshot}
                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {savingSnapshot ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    <span>Save</span>
                  </button>
                </div>
              </form>
            )}

            <div className="flex-1 overflow-y-auto p-3">
              {loading ? (
                <div className="flex items-center justify-center py-12 text-xs text-slate-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin text-indigo-600" />
                  Loading versions...
                </div>
              ) : versions.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-400">
                  No version snapshots recorded yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {versions.map((ver, index) => {
                    const isSelected = selectedVersion?.id === ver.id;
                    const versionNum = versions.length - index;
                    return (
                      <button
                        key={ver.id}
                        type="button"
                        onClick={() => setSelectedVersion(ver)}
                        className={`w-full rounded-xl border p-3 text-left transition ${
                          isSelected
                            ? 'border-indigo-400 bg-white shadow-xs ring-1 ring-indigo-300'
                            : 'border-slate-200 bg-white/70 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                            v{versionNum}
                            {index === 0 && (
                              <span className="ml-1 text-[10px] font-normal text-emerald-700">
                                (Latest)
                              </span>
                            )}
                          </span>
                          <span className="flex items-center gap-1 text-[11px] text-slate-400">
                            <Clock className="h-3 w-3" />
                            {new Date(ver.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>

                        <p className="mt-1.5 line-clamp-2 text-xs font-semibold text-slate-800">
                          {ver.summary}
                        </p>

                        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
                          <span
                            className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
                            style={{ backgroundColor: ver.author_avatar_color }}
                          >
                            {ver.author_name[0]}
                          </span>
                          <span>{ver.author_name}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Selected Version Preview & Restore Action */}
          <div className="flex min-h-0 flex-1 flex-col bg-white">
            {selectedVersion ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/50 px-6 py-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {selectedVersion.title}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {selectedVersion.summary} &bull;{' '}
                      {new Date(selectedVersion.created_at).toLocaleString()}
                    </p>
                  </div>

                  {!readOnly && (
                    <button
                      type="button"
                      disabled={restoring}
                      onClick={() => void handleRestoreVersion(selectedVersion)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {restoring ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5" />
                      )}
                      <span>Restore This Version</span>
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-6 sm:p-8">
                  <div
                    className="ProseMirror rounded-xl border border-slate-200 bg-white p-6 shadow-2xs"
                    dangerouslySetInnerHTML={{
                      __html: selectedVersion.content || '<p>Empty version</p>'
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-8 text-xs text-slate-400">
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                Select a version from the left to preview its content
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
