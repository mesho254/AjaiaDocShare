import React, { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import {
  ArrowLeft,
  Save,
  Share2,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Lock,
  ShieldCheck,
  Edit3,
  Radio,
  History,
  MessageSquarePlus
} from 'lucide-react';
import {
  ActiveCollaborator,
  API_BASE,
  api,
  CursorState,
  DocumentItem
} from '../api/client';
import { Toolbar } from './Toolbar';
import { VersionHistoryModal } from './VersionHistoryModal';
import { CommentsDrawer } from './CommentsDrawer';

interface EditorViewProps {
  activeUserId: string;
  document: DocumentItem;
  onBack: () => void;
  onSave: (payload: {
    title?: string;
    content?: string;
    clientId?: string;
    selectionFrom?: number | null;
    selectionTo?: number | null;
    createVersion?: boolean;
    versionSummary?: string;
  }) => Promise<DocumentItem>;
  onOpenShare: () => void;
  onOpenImportFile: (onImportedHtml: (html: string) => void) => void;
}

type SaveState = 'saved' | 'saving' | 'unsaved' | 'error';

export const EditorView: React.FC<EditorViewProps> = ({
  activeUserId,
  document: doc,
  onBack,
  onSave,
  onOpenShare,
  onOpenImportFile
}) => {
  const isReadOnly = doc.access_role === 'viewer';
  const isOwner = doc.access_role === 'owner';

  const [title, setTitle] = useState(doc.title);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [collaborators, setCollaborators] = useState<ActiveCollaborator[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<
    Record<string, CursorState>
  >({});
  const [liveUpdateBanner, setLiveUpdateBanner] = useState<string | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState<boolean>(false);
  const [commentsDrawerOpen, setCommentsDrawerOpen] = useState<boolean>(false);
  const [openCommentsCount, setOpenCommentsCount] = useState<number>(
    doc.comment_count ?? 0
  );
  const [selectedEditorText, setSelectedEditorText] = useState<string>('');
  const [, setLayoutTick] = useState<number>(0);

  const paperContainerRef = useRef<HTMLDivElement | null>(null);
  const clientIdRef = useRef<string>(
    `client-${Math.random().toString(36).slice(2, 10)}`
  );
  const activeUserIdRef = useRef<string>(activeUserId);
  const docIdRef = useRef<string>(doc.id);
  const loadedDocIdRef = useRef<string>(doc.id);
  const debounceTimerRef = useRef<number | null>(null);
  const cursorThrottleTimerRef = useRef<number | null>(null);
  const stopTypingTimerRef = useRef<number | null>(null);
  const latestHtmlRef = useRef<string>(doc.content);
  const latestTitleRef = useRef<string>(doc.title);
  const lastUpdatedAtRef = useRef<string>(doc.updated_at);
  const lastLocalKeystrokeTimeRef = useRef<number>(0);
  const isApplyingRemoteRef = useRef<boolean>(false);

  // Keep refs synced with latest props so TipTap callbacks never use stale closures
  useEffect(() => {
    activeUserIdRef.current = activeUserId;
    docIdRef.current = doc.id;
  }, [activeUserId, doc.id]);

  const localCursorPayloadRef = useRef<{
    selectionFrom: number | null;
    selectionTo: number | null;
    mouseXRatio: number | null;
    mouseY: number | null;
    isTyping: boolean;
  }>({
    selectionFrom: 1,
    selectionTo: 1,
    mouseXRatio: null,
    mouseY: null,
    isTyping: false
  });

  function scheduleCursorBroadcast(
    patch: Partial<typeof localCursorPayloadRef.current>
  ) {
    localCursorPayloadRef.current = {
      ...localCursorPayloadRef.current,
      ...patch
    };

    if (cursorThrottleTimerRef.current) {
      return;
    }

    cursorThrottleTimerRef.current = window.setTimeout(() => {
      cursorThrottleTimerRef.current = null;
      void api
        .sendCursor(activeUserIdRef.current, docIdRef.current, {
          clientId: clientIdRef.current,
          ...localCursorPayloadRef.current
        })
        .catch(() => {
          // ignore transient cursor broadcast errors
        });
    }, 40);
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        }
      }),
      Underline,
      Placeholder.configure({
        placeholder: isReadOnly
          ? 'This document is read-only.'
          : 'Start typing your document here, or click "Import File" in the toolbar...'
      })
    ],
    content: doc.content || '<p></p>',
    editable: !isReadOnly,
    onSelectionUpdate: ({ editor: ed }) => {
      if (isApplyingRemoteRef.current) return;
      const { from, to } = ed.state.selection;
      if (to > from) {
        setSelectedEditorText(ed.state.doc.textBetween(from, to, ' '));
      }
      scheduleCursorBroadcast({
        selectionFrom: from,
        selectionTo: to,
        isTyping: false
      });
    },
    onUpdate: ({ editor: ed }) => {
      if (isReadOnly || isApplyingRemoteRef.current) return;
      const html = ed.getHTML();
      const { from, to } = ed.state.selection;
      latestHtmlRef.current = html;
      lastLocalKeystrokeTimeRef.current = Date.now();
      setSaveState('unsaved');
      scheduleCursorBroadcast({
        selectionFrom: from,
        selectionTo: to,
        isTyping: true
      });
      if (stopTypingTimerRef.current) {
        window.clearTimeout(stopTypingTimerRef.current);
      }
      stopTypingTimerRef.current = window.setTimeout(() => {
        scheduleCursorBroadcast({ isTyping: false });
      }, 1200);
      scheduleAutoSave(latestTitleRef.current, html);
    }
  });

  // Helper to apply incoming remote edits while preserving the user's cursor position
  function applyRemoteState(
    remoteTitle: string,
    remoteHtml: string,
    remoteUpdatedAt: string,
    updatedByName?: string
  ) {
    lastUpdatedAtRef.current = remoteUpdatedAt;

    if (remoteTitle !== latestTitleRef.current) {
      setTitle(remoteTitle);
      latestTitleRef.current = remoteTitle;
    }

    if (editor && remoteHtml !== latestHtmlRef.current) {
      const { from, to } = editor.state.selection;
      isApplyingRemoteRef.current = true;
      editor.commands.setContent(remoteHtml || '<p></p>', false);
      const maxPos = Math.max(1, editor.state.doc.content.size);
      try {
        editor.commands.setTextSelection({
          from: Math.min(from, maxPos),
          to: Math.min(to, maxPos)
        });
      } catch {
        // Ignore selection clamp errors
      }
      isApplyingRemoteRef.current = false;
      latestHtmlRef.current = remoteHtml;
      setLayoutTick((t) => t + 1);
    }

    if (updatedByName) {
      setLiveUpdateBanner(`Live edit by ${updatedByName}`);
      window.setTimeout(() => {
        setLiveUpdateBanner((prev) =>
          prev === `Live edit by ${updatedByName}` ? null : prev
        );
      }, 2500);
    }
  }

  // Update editor content when switching to a different document ID
  useEffect(() => {
    if (loadedDocIdRef.current !== doc.id) {
      loadedDocIdRef.current = doc.id;
      setTitle(doc.title);
      latestTitleRef.current = doc.title;
      latestHtmlRef.current = doc.content;
      lastUpdatedAtRef.current = doc.updated_at;
      setRemoteCursors({});
      if (editor) {
        isApplyingRemoteRef.current = true;
        editor.commands.setContent(doc.content || '<p></p>', false);
        isApplyingRemoteRef.current = false;
      }
      setSaveState('saved');
      setErrorMessage(null);
    }
  }, [doc.id, doc.title, doc.content, doc.updated_at, editor]);

  // Keep editable state synced when switching persona on the same open document
  useEffect(() => {
    if (editor) {
      editor.setEditable(!isReadOnly);
    }
  }, [editor, isReadOnly]);

  // Real-time Server-Sent Events (SSE) stream + fast 400ms cursor/content sync
  useEffect(() => {
    // Announce our initial cursor immediately when opening the document
    scheduleCursorBroadcast({
      selectionFrom: localCursorPayloadRef.current.selectionFrom ?? 1,
      selectionTo: localCursorPayloadRef.current.selectionTo ?? 1,
      isTyping: false
    });

    // Connect directly to Backend port 4000 in local dev to avoid Vite proxy buffering SSE
    const sseBase =
      !import.meta.env.VITE_API_URL &&
      typeof window !== 'undefined' &&
      window.location.hostname === 'localhost'
        ? 'http://localhost:4000/api'
        : API_BASE;

    const streamUrl = `${sseBase}/documents/${encodeURIComponent(
      doc.id
    )}/stream?userId=${encodeURIComponent(
      activeUserId
    )}&clientId=${encodeURIComponent(clientIdRef.current)}`;

    const es = new EventSource(streamUrl);

    es.addEventListener('presence', (evt) => {
      try {
        const data = JSON.parse((evt as MessageEvent).data) as {
          collaborators: ActiveCollaborator[];
        };
        setCollaborators(data.collaborators || []);
      } catch {
        // ignore parse error
      }
    });

    es.addEventListener('cursor-move', (evt) => {
      try {
        const cursor = JSON.parse((evt as MessageEvent).data) as CursorState;
        if (cursor.clientId === clientIdRef.current) return;
        setRemoteCursors((prev) => ({
          ...prev,
          [cursor.clientId]: cursor
        }));
      } catch {
        // ignore parse error
      }
    });

    es.addEventListener('cursor-leave', (evt) => {
      try {
        const data = JSON.parse((evt as MessageEvent).data) as {
          clientId?: string;
          userId?: string | null;
        };
        setRemoteCursors((prev) => {
          const next: Record<string, CursorState> = {};
          for (const [k, v] of Object.entries(prev)) {
            if (k === data.clientId) continue;
            if (data.userId && v.user_id === data.userId) continue;
            next[k] = v;
          }
          return next;
        });
      } catch {
        // ignore parse error
      }
    });

    es.addEventListener('doc-update', (evt) => {
      try {
        const data = JSON.parse((evt as MessageEvent).data) as {
          documentId: string;
          title: string;
          content: string;
          updated_at: string;
          updatedBy?: { id: string; name: string };
          sourceClientId?: string | null;
        };

        if (
          data.sourceClientId &&
          data.sourceClientId === clientIdRef.current
        ) {
          return;
        }

        applyRemoteState(
          data.title,
          data.content,
          data.updated_at,
          data.updatedBy?.name
        );
      } catch {
        // ignore parse error
      }
    });

    // Fast 450ms sync loop for cursors, collaborators, and content
    const pollInterval = window.setInterval(async () => {
      try {
        const res = await api.getDocument(activeUserId, doc.id, true);
        const remote = res.document;
        if (
          Date.now() - lastLocalKeystrokeTimeRef.current >= 500 &&
          remote.updated_at !== lastUpdatedAtRef.current
        ) {
          applyRemoteState(remote.title, remote.content, remote.updated_at);
        }
        if (remote.comment_count !== undefined) {
          setOpenCommentsCount(remote.comment_count);
        }
        if (res.collaborators) {
          setCollaborators(res.collaborators);
        }
        if (res.cursors) {
          const map: Record<string, CursorState> = {};
          for (const c of res.cursors) {
            if (c.clientId !== clientIdRef.current) {
              map[c.clientId] = c;
            }
          }
          setRemoteCursors(map);
        }
      } catch {
        // Ignore transient network errors during poll
      }
    }, 450);

    function handleBeforeUnload() {
      void api
        .leaveDocument(activeUserIdRef.current, docIdRef.current, clientIdRef.current)
        .catch(() => {});
    }
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      es.close();
      window.clearInterval(pollInterval);
    };
  }, [doc.id, activeUserId, editor]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
      if (cursorThrottleTimerRef.current) {
        window.clearTimeout(cursorThrottleTimerRef.current);
      }
    };
  }, []);

  function handlePaperMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!paperContainerRef.current) return;
    const rect = paperContainerRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;

    const xRatio = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width)
    );
    const yOffset = Math.max(0, e.clientY - rect.top);

    scheduleCursorBroadcast({
      mouseXRatio: Number(xRatio.toFixed(4)),
      mouseY: Math.round(yOffset),
      isTyping: Date.now() - lastLocalKeystrokeTimeRef.current < 1200
    });
  }

  function scheduleAutoSave(nextTitle: string, nextContent: string) {
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      void triggerSave(nextTitle, nextContent);
    }, 250);
  }

  async function triggerSave(
    nextTitle?: string,
    nextContent?: string,
    createVersion = false,
    versionSummary?: string
  ) {
    if (isReadOnly) return;
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const cleanTitle =
      (nextTitle ?? latestTitleRef.current).trim() || 'Untitled Document';
    const cleanContent = nextContent ?? latestHtmlRef.current;

    setSaveState('saving');
    setErrorMessage(null);

    try {
      const saved = await onSave({
        title: cleanTitle,
        content: cleanContent,
        clientId: clientIdRef.current,
        selectionFrom: localCursorPayloadRef.current.selectionFrom,
        selectionTo: localCursorPayloadRef.current.selectionTo,
        createVersion,
        versionSummary
      });
      lastUpdatedAtRef.current = saved.updated_at;
      setSaveState('saved');
    } catch (err) {
      setSaveState('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to save document'
      );
    }
  }

  function handleAcceptSuggestion(
    quotedText: string | null,
    replacementText: string
  ) {
    if (!editor || isReadOnly) return;
    const currentHtml = editor.getHTML();
    let updatedHtml = currentHtml;

    if (quotedText && currentHtml.includes(quotedText)) {
      updatedHtml = currentHtml.replace(quotedText, replacementText);
    } else {
      updatedHtml = `${currentHtml}\n<p>${replacementText}</p>`;
    }

    isApplyingRemoteRef.current = true;
    editor.commands.setContent(updatedHtml, false);
    isApplyingRemoteRef.current = false;
    latestHtmlRef.current = updatedHtml;

    void triggerSave(
      latestTitleRef.current,
      updatedHtml,
      true,
      'Accepted collaborator suggestion'
    );
  }

  function handleVersionRestored(restoredDoc: DocumentItem) {
    applyRemoteState(
      restoredDoc.title,
      restoredDoc.content,
      restoredDoc.updated_at,
      'Version Restore'
    );
  }

  // Support Ctrl+S / Cmd+S keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (!isReadOnly) {
          void triggerSave();
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setTitle(val);
    latestTitleRef.current = val;
    lastLocalKeystrokeTimeRef.current = Date.now();
    setSaveState('unsaved');
    scheduleAutoSave(val, latestHtmlRef.current);
  }

  function handleTitleBlur() {
    if (!title.trim()) {
      setTitle('Untitled Document');
      latestTitleRef.current = 'Untitled Document';
    }
    if (saveState === 'unsaved') {
      void triggerSave(latestTitleRef.current, latestHtmlRef.current);
    }
  }

  function handleImportFileClick() {
    onOpenImportFile((importedHtml: string) => {
      if (!editor) return;
      const currentHtml = editor.getHTML();
      const isBlank =
        !currentHtml ||
        currentHtml === '<p></p>' ||
        editor.getText().trim().length === 0;
      const combined = isBlank
        ? importedHtml
        : `${currentHtml}\n${importedHtml}`;
      isApplyingRemoteRef.current = true;
      editor.commands.setContent(combined, false);
      isApplyingRemoteRef.current = false;
      latestHtmlRef.current = combined;
      void triggerSave(latestTitleRef.current, combined);
    });
  }

  function handleExportMarkdown() {
    const html = editor ? editor.getHTML() : doc.content;
    const md = htmlToMarkdown(title, html);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${
      title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'document'
    }.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Compute rendered coordinates for remote text carets & mouse pointers inside paperContainerRef
  function renderCollaboratorOverlays() {
    if (!paperContainerRef.current) return null;
    const paperRect = paperContainerRef.current.getBoundingClientRect();
    if (paperRect.width <= 0) return null;

    // Deduplicate by user_id (keep the most recently updated cursor per collaborator, excluding current user)
    const byUser = new Map<string, CursorState>();
    for (const c of Object.values(remoteCursors)) {
      if (c.clientId === clientIdRef.current || c.user_id === activeUserId) {
        continue;
      }
      const existing = byUser.get(c.user_id);
      if (!existing || c.updatedAt >= existing.updatedAt) {
        byUser.set(c.user_id, c);
      }
    }

    const activeCursorList = Array.from(byUser.values());

    return activeCursorList.map((cursor) => {
      const initials = cursor.name
        .split(' ')
        .map((n) => n[0])
        .join('');

      // 1. Compute live text caret position using ProseMirror coordsAtPos
      let caretPos: { left: number; top: number; height: number } | null = null;
      if (
        editor &&
        editor.view &&
        cursor.selectionFrom !== null &&
        cursor.selectionFrom !== undefined
      ) {
        try {
          const maxDocPos = Math.max(1, editor.state.doc.content.size - 1);
          const safePos = Math.max(
            1,
            Math.min(cursor.selectionFrom, maxDocPos)
          );
          const coords = editor.view.coordsAtPos(safePos);
          caretPos = {
            left: Math.max(16, coords.left - paperRect.left),
            top: Math.max(16, coords.top - paperRect.top),
            height: Math.max(20, coords.bottom - coords.top)
          };
        } catch {
          caretPos = null;
        }
      }

      // 2. Compute live mouse pointer position relative to paper container
      let mousePos: { left: number; top: number } | null = null;
      if (
        cursor.mouseXRatio !== null &&
        cursor.mouseXRatio !== undefined &&
        cursor.mouseY !== null &&
        cursor.mouseY !== undefined
      ) {
        mousePos = {
          left: Math.round(cursor.mouseXRatio * paperRect.width),
          top: Math.round(cursor.mouseY)
        };
      }

      return (
        <React.Fragment key={cursor.user_id}>
          {/* Live Text Editing Caret + Floating User Avatar Flag */}
          {caretPos && (
            <div
              className="pointer-events-none absolute z-30 transition-all duration-100 ease-out"
              style={{
                left: `${caretPos.left}px`,
                top: `${caretPos.top}px`
              }}
            >
              {/* Colored vertical caret line */}
              <div
                className="w-[3px] rounded-full shadow-sm"
                style={{
                  height: `${caretPos.height}px`,
                  backgroundColor: cursor.avatar_color
                }}
              />

              {/* Floating User Avatar + Name Flag right above the caret */}
              <div
                className="absolute -top-6 left-0 flex items-center gap-1 whitespace-nowrap rounded-t-md rounded-br-md px-2 py-0.5 text-[11px] font-bold text-white shadow-md"
                style={{ backgroundColor: cursor.avatar_color }}
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/25 text-[9px] font-bold">
                  {initials}
                </span>
                <span>{cursor.name.split(' ')[0]}</span>
                {cursor.isTyping && (
                  <span className="ml-1 text-[9px] font-normal opacity-95">
                    typing...
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Live Mouse Pointer + User Avatar Pill */}
          {mousePos && (
            <div
              className="pointer-events-none absolute z-40 transition-all duration-100 ease-out"
              style={{
                left: `${mousePos.left}px`,
                top: `${mousePos.top}px`
              }}
            >
              {/* SVG Pointer Arrow */}
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill={cursor.avatar_color}
                stroke="white"
                strokeWidth="2"
                className="-translate-x-0.5 -translate-y-0.5 drop-shadow-md"
              >
                <path d="M4 3l16 7-7 2-2 7-7-16z" />
              </svg>

              {/* Floating User Avatar + Name Pill beside the mouse cursor */}
              <div
                className="ml-3 -mt-1 flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white shadow-md ring-2 ring-white"
                style={{ backgroundColor: cursor.avatar_color }}
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/25 text-[9px] font-bold">
                  {initials}
                </span>
                <span>{cursor.name}</span>
              </div>
            </div>
          )}
        </React.Fragment>
      );
    });
  }

  const plainText = editor ? editor.getText().trim() : '';
  const wordCount = plainText ? plainText.split(/\s+/).length : 0;
  const charCount = plainText.length;

  return (
    <div className="min-h-screen bg-slate-100 pb-16">
      {/* Document Header Bar */}
      <div className="no-print border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          {/* Left: Back button + Editable Title */}
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              onClick={() => {
                void api
                  .leaveDocument(
                    activeUserIdRef.current,
                    docIdRef.current,
                    clientIdRef.current
                  )
                  .catch(() => {});
                onBack();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">All Docs</span>
            </button>

            <div className="min-w-0 flex-1">
              <input
                type="text"
                value={title}
                disabled={isReadOnly}
                onChange={handleTitleChange}
                onBlur={handleTitleBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  }
                }}
                placeholder="Untitled Document"
                className={`w-full truncate rounded-lg border border-transparent px-2 py-1 text-lg font-bold text-slate-900 transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                  isReadOnly
                    ? 'cursor-default bg-transparent'
                    : 'hover:border-slate-200'
                }`}
              />
            </div>
          </div>

          {/* Right: Live Presence Avatars, Access Role Pill, Save Status, Save & Share Buttons */}
          <div className="flex items-center gap-2.5">
            {/* Live Active Collaborators Indicator */}
            {collaborators.length > 0 && (
              <div
                className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/80 px-2.5 py-1 text-[11px] font-medium text-emerald-800"
                title={`Currently viewing: ${collaborators
                  .map((c) => c.name)
                  .join(', ')}`}
              >
                <Radio className="h-3 w-3 animate-pulse text-emerald-600" />
                <div className="flex -space-x-1.5">
                  {collaborators.map((c) => (
                    <span
                      key={c.user_id}
                      className="flex h-5 w-5 items-center justify-center rounded-full border border-white text-[9px] font-bold text-white shadow-2xs"
                      style={{ backgroundColor: c.avatar_color }}
                    >
                      {c.name[0]}
                    </span>
                  ))}
                </div>
                <span className="hidden lg:inline">
                  {liveUpdateBanner || `${collaborators.length} live`}
                </span>
              </div>
            )}

            {/* Ownership / Permission Badge */}
            {isOwner ? (
              <span className="hidden md:inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                Owner
              </span>
            ) : doc.access_role === 'editor' ? (
              <span className="hidden md:inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                <Edit3 className="h-3.5 w-3.5" />
                Editor (Owner: {doc.owner_name.split(' ')[0]})
              </span>
            ) : (
              <span className="hidden md:inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                <Lock className="h-3.5 w-3.5" />
                View Only (Owner: {doc.owner_name.split(' ')[0]})
              </span>
            )}

            {/* Save Status Pill */}
            {!isReadOnly && (
              <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                {saveState === 'saving' && (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                    <span>Saving...</span>
                  </>
                )}
                {saveState === 'saved' && (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Saved</span>
                  </>
                )}
                {saveState === 'unsaved' && (
                  <span className="text-amber-600">Syncing...</span>
                )}
                {saveState === 'error' && (
                  <span
                    className="flex items-center gap-1 text-rose-600"
                    title={errorMessage || ''}
                  >
                    <AlertCircle className="h-3.5 w-3.5" />
                    Save failed
                  </span>
                )}
              </div>
            )}

            {!isReadOnly && (
              <button
                type="button"
                onClick={() => void triggerSave(undefined, undefined, true)}
                title="Save checkpoint now (Ctrl+S)"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <Save className="h-3.5 w-3.5 text-indigo-600" />
                <span>Save</span>
              </button>
            )}

            {/* Version History Button (Stretch Feature) */}
            <button
              type="button"
              onClick={() => setHistoryModalOpen(true)}
              title="View or restore document version history"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <History className="h-3.5 w-3.5 text-indigo-600" />
              <span className="hidden sm:inline">History</span>
            </button>

            {/* Comments & Suggestions Mode Button (Stretch Feature) */}
            <button
              type="button"
              onClick={() => setCommentsDrawerOpen(true)}
              title="Open Comments & Suggestion Mode"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <MessageSquarePlus className="h-3.5 w-3.5 text-indigo-600" />
              <span className="hidden sm:inline">Comments</span>
              {openCommentsCount > 0 && (
                <span className="rounded-full bg-amber-100 px-1.5 py-0.2 text-[10px] font-bold text-amber-800">
                  {openCommentsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={onOpenShare}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>Share</span>
              {doc.shares.length > 0 && (
                <span className="ml-0.5 rounded-full bg-indigo-500 px-1.5 py-0.2 text-[10px]">
                  {doc.shares.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Formatting Toolbar */}
      <div className="mx-auto max-w-5xl">
        <Toolbar
          editor={editor}
          readOnly={isReadOnly}
          onImportIntoDraft={handleImportFileClick}
          onExportMarkdown={handleExportMarkdown}
          onPrintPdf={() => window.print()}
        />
      </div>

      {/* Read-Only Banner when opened by a Viewer */}
      {isReadOnly && (
        <div className="no-print mx-auto mt-4 max-w-4xl px-4">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 shrink-0 text-amber-600" />
              <span>
                <strong>Read-Only Mode:</strong> This document was shared with
                you by <strong>{doc.owner_name}</strong> ({doc.owner_email})
                with <em>View Only</em> permissions. Any edits or cursor
                movements by collaborators will appear here live.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Save Error Banner */}
      {errorMessage && (
        <div className="no-print mx-auto mt-4 max-w-4xl px-4">
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-800">
            <AlertCircle className="h-4 w-4 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Main Paper Canvas with Live Collaborator Carets & Mouse Pointers */}
      <div className="mx-auto mt-6 max-w-4xl px-4">
        <div
          ref={paperContainerRef}
          onMouseMove={handlePaperMouseMove}
          className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-8 py-10 shadow-sm sm:px-14 sm:py-12"
        >
          {/* Live Collaborator Carets & Mouse Pointers Overlay */}
          {renderCollaboratorOverlays()}

          <EditorContent editor={editor} />
        </div>

        {/* Footer Metadata Bar */}
        <div className="no-print mt-3 flex flex-wrap items-center justify-between gap-2 px-2 text-xs text-slate-500">
          <div>
            Owner: <strong className="text-slate-700">{doc.owner_name}</strong>{' '}
            ({doc.owner_email})
            {doc.source_filename && (
              <span className="ml-3">
                Source file:{' '}
                <strong className="text-slate-700">{doc.source_filename}</strong>
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span>{wordCount} words</span>
            <span>{charCount} characters</span>
          </div>
        </div>
      </div>

      <VersionHistoryModal
        isOpen={historyModalOpen}
        activeUserId={activeUserId}
        document={doc}
        readOnly={isReadOnly}
        onClose={() => setHistoryModalOpen(false)}
        onRestored={handleVersionRestored}
      />

      <CommentsDrawer
        isOpen={commentsDrawerOpen}
        activeUserId={activeUserId}
        document={doc}
        selectedEditorText={selectedEditorText}
        canApplySuggestions={!isReadOnly}
        onClose={() => setCommentsDrawerOpen(false)}
        onAcceptSuggestion={handleAcceptSuggestion}
        onCommentsCountChange={setOpenCommentsCount}
      />
    </div>
  );
};

function htmlToMarkdown(title: string, html: string): string {
  const body = html
    .replace(/<h1>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3>(.*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i>(.*?)<\/i>/gi, '*$1*')
    .replace(/<u>(.*?)<\/u>/gi, '_$1_')
    .replace(/<li><p>(.*?)<\/p><\/li>/gi, '- $1\n')
    .replace(/<li>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<\/?(ul|ol)>/gi, '\n')
    .replace(/<p>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return `# ${title}\n\n${body}\n`;
}
