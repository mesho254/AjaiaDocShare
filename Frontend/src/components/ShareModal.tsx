import React, { useState } from 'react';
import { Share2, X, ShieldCheck, Trash2, UserPlus, AlertCircle, Lock } from 'lucide-react';
import { DocumentItem, ShareRole, User } from '../api/client';

interface ShareModalProps {
  isOpen: boolean;
  document: DocumentItem | null;
  users: User[];
  onClose: () => void;
  onShare: (docId: string, payload: { email?: string; userId?: string; role: ShareRole }) => Promise<void>;
  onRevoke: (docId: string, shareId: string) => Promise<void>;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  document: doc,
  users,
  onClose,
  onShare,
  onRevoke
}) => {
  const [selectedEmail, setSelectedEmail] = useState('');
  const [role, setRole] = useState<ShareRole>('editor');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !doc) return null;

  const isOwner = doc.access_role === 'owner';
  const availableTeammates = users.filter((u) => u.id !== doc.owner_id);

  async function handleGrantAccess(e: React.FormEvent) {
    e.preventDefault();
    if (!doc) return;
    if (!selectedEmail.trim()) {
      setError('Please select a teammate or enter an email address.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onShare(doc.id, { email: selectedEmail.trim(), role });
      setSelectedEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update sharing settings');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRoleChange(userEmail: string, nextRole: ShareRole) {
    if (!doc) return;
    setError(null);
    try {
      await onShare(doc.id, { email: userEmail, role: nextRole });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update role');
    }
  }

  async function handleRevokeClick(shareId: string) {
    if (!doc) return;
    setError(null);
    try {
      await onRevoke(doc.id, shareId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not revoke access');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Share &ldquo;{doc.title}&rdquo;
              </h2>
              <p className="text-xs text-slate-500">
                Manage who can view or edit this document
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

        {/* Add Collaborator Form (Owner Only) */}
        {isOwner ? (
          <form onSubmit={handleGrantAccess} className="mt-4 space-y-3">
            <label className="block text-xs font-semibold text-slate-700">
              Grant Access to Teammate
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="email"
                list="seeded-teammates"
                value={selectedEmail}
                onChange={(e) => setSelectedEmail(e.target.value)}
                placeholder="Enter email (e.g. liam@ajaia.io)..."
                className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <datalist id="seeded-teammates">
                {availableTeammates.map((u) => (
                  <option key={u.id} value={u.email}>
                    {u.name} ({u.role_title})
                  </option>
                ))}
              </datalist>

              <select
                value={role}
                onChange={(e) => setRole(e.target.value as ShareRole)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-indigo-500 focus:outline-none"
              >
                <option value="editor">Can Edit</option>
                <option value="viewer">View Only</option>
              </select>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Share</span>
              </button>
            </div>

            {/* Quick-pick seeded pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-slate-400">Quick select:</span>
              {availableTeammates.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelectedEmail(u.email)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  {u.name} ({u.email})
                </button>
              ))}
            </div>
          </form>
        ) : (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <Lock className="h-4 w-4 shrink-0 text-slate-400" />
            <span>
              Only the document owner (<strong>{doc.owner_name}</strong>) can add or remove collaborators.
            </span>
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Access List */}
        <div className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            People with Access
          </h3>

          <div className="mt-2.5 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {/* Document Owner Row */}
            <div className="flex items-center justify-between px-3.5 py-2.5">
              <div className="flex items-center gap-2.5">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: doc.owner_avatar_color }}
                >
                  {doc.owner_name[0]}
                </span>
                <div>
                  <p className="text-xs font-semibold text-slate-900">{doc.owner_name}</p>
                  <p className="text-[11px] text-slate-500">{doc.owner_email}</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700">
                <ShieldCheck className="h-3 w-3" />
                Owner
              </span>
            </div>

            {/* Shared Collaborators */}
            {doc.shares.length === 0 ? (
              <div className="px-3.5 py-4 text-center text-xs text-slate-400">
                Private to owner — not shared with anyone yet.
              </div>
            ) : (
              doc.shares.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between px-3.5 py-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: s.avatar_color }}
                    >
                      {s.user_name[0]}
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-slate-900">{s.user_name}</p>
                      <p className="text-[11px] text-slate-500">{s.user_email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isOwner ? (
                      <>
                        <select
                          value={s.role}
                          onChange={(e) =>
                            void handleRoleChange(s.user_email, e.target.value as ShareRole)
                          }
                          className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700"
                        >
                          <option value="editor">Can Edit</option>
                          <option value="viewer">View Only</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => void handleRevokeClick(s.id)}
                          title="Revoke access"
                          className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700">
                        {s.role === 'editor' ? 'Can Edit' : 'View Only'}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
