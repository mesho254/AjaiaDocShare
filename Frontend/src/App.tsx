import React, { useCallback, useEffect, useState } from 'react';
import { api, DocumentItem, ShareRole, User } from './api/client';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { EditorView } from './components/EditorView';
import { UploadModal } from './components/UploadModal';
import { ShareModal } from './components/ShareModal';

export const App: React.FC = () => {
  const [activeUserId, setActiveUserId] = useState<string>(() => {
    return (
      sessionStorage.getItem('ajaia_active_user') ||
      localStorage.getItem('ajaia_active_user') ||
      'user-alice'
    );
  });
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState<boolean>(true);
  const [filter, setFilter] = useState<'all' | 'owned' | 'shared'>('all');
  const [search, setSearch] = useState<string>('');

  const [activeDoc, setActiveDoc] = useState<DocumentItem | null>(null);
  const [toast, setToast] = useState<{ type: 'info' | 'error'; message: string } | null>(null);

  // Modals
  const [uploadModalState, setUploadModalState] = useState<{
    open: boolean;
    mode: 'create' | 'extract';
    onExtractCallback?: (html: string) => void;
  }>({ open: false, mode: 'create' });

  const [shareModalDoc, setShareModalDoc] = useState<DocumentItem | null>(null);

  function showToast(message: string, type: 'info' | 'error' = 'info') {
    setToast({ message, type });
    window.setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 3500);
  }

  // Only fetches users and the dashboard document list — never overrides activeDoc
  const fetchUsersAndDocs = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const [userRes, docsRes] = await Promise.all([
        api.getUsers(activeUserId),
        api.listDocuments(activeUserId, filter, search)
      ]);
      setUsers(userRes.users);
      setCurrentUser(userRes.currentUser);
      setDocuments(docsRes.documents);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load workspace data', 'error');
    } finally {
      setLoadingDocs(false);
    }
  }, [activeUserId, filter, search]);

  useEffect(() => {
    void fetchUsersAndDocs();
  }, [fetchUsersAndDocs]);

  async function handleSelectUser(nextUserId: string) {
    sessionStorage.setItem('ajaia_active_user', nextUserId);
    localStorage.setItem('ajaia_active_user', nextUserId);
    setActiveUserId(nextUserId);

    // If a document is currently open, check whether the newly selected persona has access
    if (activeDoc) {
      try {
        const refreshed = await api.getDocument(nextUserId, activeDoc.id);
        setActiveDoc(refreshed.document);
      } catch {
        setActiveDoc(null);
        const targetUser = users.find((u) => u.id === nextUserId);
        showToast(
          `Switched to ${targetUser?.name || nextUserId}. That document is not shared with this account.`,
          'info'
        );
      }
    }
  }

  function handleBackToDashboard() {
    setActiveDoc(null);
    void fetchUsersAndDocs();
  }

  async function handleCreateBlankDocument() {
    try {
      const res = await api.createDocument(activeUserId, {
        title: 'Untitled Document',
        content: '<p></p>'
      });
      setActiveDoc(res.document);
      void fetchUsersAndDocs();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not create document', 'error');
    }
  }

  async function handleOpenDocument(docId: string) {
    try {
      const res = await api.getDocument(activeUserId, docId);
      setActiveDoc(res.document);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not open document', 'error');
    }
  }

  async function handleSaveDocument(payload: {
    title?: string;
    content?: string;
    clientId?: string;
    selectionFrom?: number | null;
    selectionTo?: number | null;
    createVersion?: boolean;
    versionSummary?: string;
  }) {
    if (!activeDoc) throw new Error('No active document');
    const res = await api.updateDocument(activeUserId, activeDoc.id, payload);
    setActiveDoc(res.document);
    setDocuments((prev) => prev.map((d) => (d.id === res.document.id ? res.document : d)));
    return res.document;
  }

  async function handleDeleteDocument(doc: DocumentItem) {
    if (!window.confirm(`Delete "${doc.title}" permanently?`)) {
      return;
    }
    try {
      await api.deleteDocument(activeUserId, doc.id);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      if (activeDoc?.id === doc.id) {
        setActiveDoc(null);
      }
      showToast(`Deleted "${doc.title}"`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete document', 'error');
    }
  }

  async function handleUploadFile(file: File, customTitle?: string) {
    if (uploadModalState.mode === 'extract') {
      const res = await api.uploadFile(activeUserId, file, { mode: 'extract' });
      if (uploadModalState.onExtractCallback) {
        uploadModalState.onExtractCallback(res.parsed.htmlContent);
      }
      showToast(`Imported content from ${file.name}`);
      return;
    }

    const res = await api.uploadFile(activeUserId, file, {
      mode: 'create',
      title: customTitle
    });
    if (res.document) {
      setActiveDoc(res.document);
      void fetchUsersAndDocs();
      showToast(`Created document from ${file.name}`);
    }
  }

  async function handleShareDocument(
    docId: string,
    payload: { email?: string; userId?: string; role: ShareRole }
  ) {
    const res = await api.shareDocument(activeUserId, docId, payload);
    setShareModalDoc(res.document);
    if (activeDoc?.id === docId) {
      setActiveDoc(res.document);
    }
    setDocuments((prev) => prev.map((d) => (d.id === docId ? res.document : d)));
    showToast('Updated sharing permissions');
  }

  async function handleRevokeShare(docId: string, shareId: string) {
    const res = await api.revokeShare(activeUserId, docId, shareId);
    setShareModalDoc(res.document);
    if (activeDoc?.id === docId) {
      setActiveDoc(res.document);
    }
    setDocuments((prev) => prev.map((d) => (d.id === docId ? res.document : d)));
    showToast('Revoked collaborator access');
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar
        users={users}
        currentUser={currentUser}
        onSelectUser={(userId) => void handleSelectUser(userId)}
        onNavigateHome={handleBackToDashboard}
      />

      {toast && (
        <div className="no-print fixed bottom-5 right-5 z-50 rounded-xl border border-slate-200 bg-slate-900 px-4 py-2.5 text-xs font-medium text-white shadow-lg">
          {toast.message}
        </div>
      )}

      {activeDoc ? (
        <EditorView
          activeUserId={activeUserId}
          document={activeDoc}
          onBack={handleBackToDashboard}
          onSave={handleSaveDocument}
          onOpenShare={() => setShareModalDoc(activeDoc)}
          onOpenImportFile={(cb) =>
            setUploadModalState({
              open: true,
              mode: 'extract',
              onExtractCallback: cb
            })
          }
        />
      ) : (
        <Dashboard
          currentUser={currentUser}
          documents={documents}
          loading={loadingDocs}
          filter={filter}
          search={search}
          onFilterChange={setFilter}
          onSearchChange={setSearch}
          onOpenDocument={(id) => void handleOpenDocument(id)}
          onCreateBlank={() => void handleCreateBlankDocument()}
          onOpenUploadModal={() => setUploadModalState({ open: true, mode: 'create' })}
          onOpenShareModal={(doc) => setShareModalDoc(doc)}
          onDeleteDocument={(doc) => void handleDeleteDocument(doc)}
        />
      )}

      <UploadModal
        isOpen={uploadModalState.open}
        mode={uploadModalState.mode}
        onClose={() => setUploadModalState({ open: false, mode: 'create' })}
        onUpload={handleUploadFile}
      />

      <ShareModal
        isOpen={Boolean(shareModalDoc)}
        document={shareModalDoc}
        users={users}
        onClose={() => setShareModalDoc(null)}
        onShare={handleShareDocument}
        onRevoke={handleRevokeShare}
      />
    </div>
  );
};
