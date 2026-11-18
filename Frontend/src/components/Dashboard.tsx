import React from 'react';
import {
  Plus,
  Upload,
  Search,
  FileText,
  Share2,
  Trash2,
  ShieldCheck,
  Eye,
  Edit3,
  Clock,
  FileUp
} from 'lucide-react';
import { DocumentItem, User } from '../api/client';

interface DashboardProps {
  currentUser: User | null;
  documents: DocumentItem[];
  loading: boolean;
  filter: 'all' | 'owned' | 'shared';
  search: string;
  onFilterChange: (next: 'all' | 'owned' | 'shared') => void;
  onSearchChange: (next: string) => void;
  onOpenDocument: (docId: string) => void;
  onCreateBlank: () => void;
  onOpenUploadModal: () => void;
  onOpenShareModal: (doc: DocumentItem) => void;
  onDeleteDocument: (doc: DocumentItem) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  currentUser,
  documents,
  loading,
  filter,
  search,
  onFilterChange,
  onSearchChange,
  onOpenDocument,
  onCreateBlank,
  onOpenUploadModal,
  onOpenShareModal,
  onDeleteDocument
}) => {
  function stripHtmlPreview(html: string): string {
    const plain = html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return plain || 'Empty document — click to start writing...';
  }

  function formatDate(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return iso;
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Top Hero & Action Bar */}
      <div className="mb-8 flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">
              {currentUser ? `${currentUser.name}'s Workspace` : 'Documents'}
            </h1>
            {currentUser && (
              <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                {currentUser.email}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Create rich-text documents, import <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">.txt</code>,{' '}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">.md</code>, or{' '}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">.docx</code> files, and share with granular permissions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenUploadModal}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <Upload className="h-4 w-4 text-indigo-600" />
            <span>Upload File</span>
          </button>

          <button
            type="button"
            onClick={onCreateBlank}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            <span>New Document</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs (All vs Owned vs Shared) & Search */}
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => onFilterChange('all')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              filter === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Accessible
          </button>
          <button
            type="button"
            onClick={() => onFilterChange('owned')}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              filter === 'owned'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Owned by Me</span>
          </button>
          <button
            type="button"
            onClick={() => onFilterChange('shared')}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              filter === 'shared'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>Shared with Me</span>
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by title or owner..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder-slate-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      </div>

      {/* Document Cards Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-48 animate-pulse rounded-2xl border border-slate-200 bg-white p-5"
            />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
            <FileText className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">No documents found</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            {filter === 'owned'
              ? 'You have not created any documents yet. Click "New Document" or upload a file to get started.'
              : filter === 'shared'
              ? 'No documents have been shared with this account yet. Try switching personas or sharing a document.'
              : 'Create a blank document or upload a .txt, .md, or .docx file to begin.'}
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              type="button"
              onClick={onCreateBlank}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              New Document
            </button>
            <button
              type="button"
              onClick={onOpenUploadModal}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Upload className="h-4 w-4" />
              Upload File
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => {
            const isOwner = doc.access_role === 'owner';
            const isEditor = doc.access_role === 'editor';

            return (
              <div
                key={doc.id}
                onClick={() => onOpenDocument(doc.id)}
                className="group relative flex cursor-pointer flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
              >
                <div>
                  {/* Ownership & Access Badges */}
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    {isOwner ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700 border border-indigo-200">
                        <ShieldCheck className="h-3 w-3" />
                        Owned by Me
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                        <Share2 className="h-3 w-3" />
                        Shared by {doc.owner_name.split(' ')[0]}
                      </span>
                    )}

                    {!isOwner && (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          isEditor
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {isEditor ? (
                          <>
                            <Edit3 className="h-2.5 w-2.5" />
                            Can Edit
                          </>
                        ) : (
                          <>
                            <Eye className="h-2.5 w-2.5" />
                            View Only
                          </>
                        )}
                      </span>
                    )}
                  </div>

                  {/* Document Title */}
                  <h2 className="line-clamp-1 text-base font-bold text-slate-900 group-hover:text-indigo-600">
                    {doc.title}
                  </h2>

                  {/* Imported File Badge if created via upload */}
                  {doc.source_filename && (
                    <div className="mt-1 inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                      <FileUp className="h-3 w-3 text-indigo-500" />
                      <span>Imported from {doc.source_filename}</span>
                    </div>
                  )}

                  {/* Snippet Preview */}
                  <p className="mt-2.5 line-clamp-3 text-xs leading-relaxed text-slate-600">
                    {stripHtmlPreview(doc.content)}
                  </p>
                </div>

                {/* Card Footer: Timestamp, Collaborators & Actions */}
                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Clock className="h-3 w-3" />
                    <span>{formatDate(doc.updated_at)}</span>
                  </div>

                  <div
                    className="flex items-center gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Collaborator count pill */}
                    {doc.shares.length > 0 && (
                      <span
                        title={`Shared with ${doc.shares.map((s) => `${s.user_name} (${s.role})`).join(', ')}`}
                        className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600"
                      >
                        +{doc.shares.length} shared
                      </span>
                    )}

                    {isOwner && (
                      <>
                        <button
                          type="button"
                          onClick={() => onOpenShareModal(doc)}
                          title="Share document"
                          className="rounded-lg p-1.5 text-slate-500 transition hover:bg-indigo-50 hover:text-indigo-600"
                        >
                          <Share2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteDocument(doc)}
                          title="Delete document"
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
};
