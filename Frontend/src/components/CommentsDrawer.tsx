import React, { useEffect, useState } from 'react';
import {
  MessageSquarePlus,
  Sparkles,
  X,
  Check,
  Trash2,
  RotateCcw,
  Loader2,
  AlertCircle,
  Quote
} from 'lucide-react';
import {
  api,
  CommentType,
  DocumentComment,
  DocumentItem
} from '../api/client';

interface CommentsDrawerProps {
  isOpen: boolean;
  activeUserId: string;
  document: DocumentItem;
  selectedEditorText: string;
  canApplySuggestions: boolean;
  onClose: () => void;
  onAcceptSuggestion: (quotedText: string | null, replacementText: string) => void;
  onCommentsCountChange: (openCount: number) => void;
}

export const CommentsDrawer: React.FC<CommentsDrawerProps> = ({
  isOpen,
  activeUserId,
  document: doc,
  selectedEditorText,
  canApplySuggestions,
  onClose,
  onAcceptSuggestion,
  onCommentsCountChange
}) => {
  const [comments, setComments] = useState<DocumentComment[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [mode, setMode] = useState<CommentType>('comment');
  const [quotedText, setQuotedText] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [filterTab, setFilterTab] = useState<'open' | 'resolved'>('open');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    void loadComments();
  }, [isOpen, doc.id, activeUserId]);

  useEffect(() => {
    if (selectedEditorText.trim()) {
      setQuotedText(selectedEditorText.trim());
    }
  }, [selectedEditorText, isOpen]);

  async function loadComments() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listComments(activeUserId, doc.id);
      setComments(res.comments);
      onCommentsCountChange(res.comments.filter((c) => !c.resolved).length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await api.createComment(activeUserId, doc.id, {
        type: mode,
        quoted_text: quotedText.trim() || null,
        content: content.trim()
      });
      setComments(res.comments);
      onCommentsCountChange(res.comments.filter((c) => !c.resolved).length);
      setContent('');
      setQuotedText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleResolve(comment: DocumentComment) {
    try {
      const res = await api.resolveComment(
        activeUserId,
        doc.id,
        comment.id,
        !comment.resolved
      );
      setComments(res.comments);
      onCommentsCountChange(res.comments.filter((c) => !c.resolved).length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update status');
    }
  }

  async function handleApplyAndResolve(comment: DocumentComment) {
    onAcceptSuggestion(comment.quoted_text, comment.content);
    await handleToggleResolve(comment);
  }

  async function handleDelete(commentId: string) {
    try {
      const res = await api.deleteComment(activeUserId, doc.id, commentId);
      setComments(res.comments);
      onCommentsCountChange(res.comments.filter((c) => !c.resolved).length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete comment');
    }
  }

  if (!isOpen) return null;

  const visibleComments = comments.filter((c) =>
    filterTab === 'open' ? !c.resolved : c.resolved
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/35 backdrop-blur-2xs">
      <div className="flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <MessageSquarePlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Comments &amp; Suggestions
              </h2>
              <p className="text-xs text-slate-500">
                Leave feedback or propose text edits (even in View Only mode)
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

        {/* Compose Form */}
        <form
          onSubmit={handleSubmit}
          className="border-b border-slate-200 bg-slate-50/70 p-4 space-y-3"
        >
          {/* Mode Switcher: Comment vs Suggestion */}
          <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setMode('comment')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${
                mode === 'comment'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MessageSquarePlus className="h-3.5 w-3.5" />
              <span>Comment</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('suggestion')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${
                mode === 'suggestion'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Suggestion Mode</span>
            </button>
          </div>

          {/* Target / Quoted Phrase Input */}
          <div>
            <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
              <Quote className="h-3 w-3 text-indigo-500" />
              <span>
                {mode === 'suggestion'
                  ? 'Phrase in document to replace (select text in editor or type here):'
                  : 'Quoted text context (optional):'}
              </span>
            </label>
            <input
              type="text"
              value={quotedText}
              onChange={(e) => setQuotedText(e.target.value)}
              placeholder="Highlight text in the editor or type a phrase..."
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Comment / Replacement Content */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600">
              {mode === 'suggestion'
                ? 'Suggested replacement text:'
                : 'Your comment:'}
            </label>
            <textarea
              rows={2}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                mode === 'suggestion'
                  ? 'Type the suggested new wording...'
                  : 'Add a comment or question for collaborators...'
              }
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-800">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!content.trim() || submitting}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition disabled:opacity-50 ${
                mode === 'suggestion'
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>
                {mode === 'suggestion' ? 'Post Suggestion' : 'Post Comment'}
              </span>
            </button>
          </div>
        </form>

        {/* Filter Tabs: Open vs Resolved */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-2.5">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFilterTab('open')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                filterTab === 'open'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Open ({comments.filter((c) => !c.resolved).length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('resolved')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                filterTab === 'resolved'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Resolved ({comments.filter((c) => c.resolved).length})
            </button>
          </div>
        </div>

        {/* Comments & Suggestions List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-xs text-slate-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-indigo-600" />
              Loading threads...
            </div>
          ) : visibleComments.length === 0 ? (
            <p className="py-10 text-center text-xs text-slate-400">
              {filterTab === 'open'
                ? 'No open comments or suggestions on this document.'
                : 'No resolved items yet.'}
            </p>
          ) : (
            visibleComments.map((item) => {
              const isSuggestion = item.type === 'suggestion';
              const canDelete =
                item.author_id === activeUserId || doc.access_role === 'owner';

              return (
                <div
                  key={item.id}
                  className={`rounded-xl border p-3.5 shadow-2xs ${
                    isSuggestion
                      ? 'border-amber-200 bg-amber-50/40'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  {/* Author & Type Header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ backgroundColor: item.author_avatar_color }}
                      >
                        {item.author_name[0]}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {item.author_name}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {new Date(item.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        isSuggestion
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      }`}
                    >
                      {isSuggestion ? (
                        <>
                          <Sparkles className="h-2.5 w-2.5" />
                          Suggestion
                        </>
                      ) : (
                        'Comment'
                      )}
                    </span>
                  </div>

                  {/* Quoted Text Context */}
                  {item.quoted_text && (
                    <div className="mt-2.5 rounded-lg border-l-2 border-indigo-400 bg-slate-100/80 px-2.5 py-1.5 text-[11px] italic text-slate-600">
                      &ldquo;{item.quoted_text}&rdquo;
                    </div>
                  )}

                  {/* Body */}
                  <div className="mt-2 text-xs leading-relaxed text-slate-800">
                    {isSuggestion ? (
                      <div>
                        <span className="font-semibold text-amber-800">
                          Replace with:{' '}
                        </span>
                        <span className="rounded bg-emerald-100/80 px-1 py-0.5 font-medium text-emerald-900">
                          {item.content}
                        </span>
                      </div>
                    ) : (
                      item.content
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="mt-3 flex flex-wrap items-center justify-end gap-1.5 border-t border-slate-100 pt-2.5">
                    {isSuggestion && !item.resolved && canApplySuggestions && (
                      <button
                        type="button"
                        onClick={() => void handleApplyAndResolve(item)}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                      >
                        <Check className="h-3 w-3" />
                        <span>Accept Suggestion</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => void handleToggleResolve(item)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                    >
                      {item.resolved ? (
                        <>
                          <RotateCcw className="h-3 w-3" />
                          <span>Reopen</span>
                        </>
                      ) : (
                        <>
                          <Check className="h-3 w-3 text-emerald-600" />
                          <span>Resolve</span>
                        </>
                      )}
                    </button>

                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => void handleDelete(item.id)}
                        title="Delete"
                        className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
