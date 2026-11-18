export type ShareRole = 'editor' | 'viewer';
export type EffectiveRole = 'owner' | ShareRole;

export interface User {
  id: string;
  name: string;
  email: string;
  role_title: string;
  avatar_color: string;
  created_at: string;
}

export interface ShareDetail {
  id: string;
  document_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  avatar_color: string;
  role: ShareRole;
  created_at: string;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  title: string;
  content: string;
  author_id: string;
  author_name: string;
  author_email: string;
  author_avatar_color: string;
  summary: string;
  created_at: string;
}

export type CommentType = 'comment' | 'suggestion';

export interface DocumentComment {
  id: string;
  document_id: string;
  author_id: string;
  author_name: string;
  author_email: string;
  author_avatar_color: string;
  type: CommentType;
  quoted_text: string | null;
  content: string;
  resolved: boolean;
  created_at: string;
}

export interface DocumentItem {
  id: string;
  title: string;
  content: string;
  owner_id: string;
  owner_name: string;
  owner_email: string;
  owner_avatar_color: string;
  source_filename: string | null;
  access_role: EffectiveRole;
  shares: ShareDetail[];
  comment_count?: number;
  version_count?: number;
  created_at: string;
  updated_at: string;
}

export interface ActiveCollaborator {
  user_id: string;
  name: string;
  email: string;
  avatar_color: string;
}

export interface CursorState {
  clientId: string;
  user_id: string;
  name: string;
  email: string;
  avatar_color: string;
  selectionFrom: number | null;
  selectionTo: number | null;
  mouseXRatio: number | null;
  mouseY: number | null;
  isTyping: boolean;
  updatedAt: number;
}

export const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function request<T>(
  path: string,
  userId: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('x-user-id', userId);
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    cache: 'no-store',
    headers
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message = data?.error?.message || `Request failed with status ${res.status}`;
    throw new Error(message);
  }

  return data as T;
}

export const api = {
  getUsers(userId: string) {
    return request<{ users: User[]; currentUser: User }>('/users', userId);
  },

  listDocuments(userId: string, filter: 'all' | 'owned' | 'shared' = 'all', search = '') {
    const params = new URLSearchParams({ filter });
    if (search.trim()) {
      params.set('search', search.trim());
    }
    return request<{ documents: DocumentItem[] }>(`/documents?${params.toString()}`, userId);
  },

  getDocument(userId: string, docId: string, trackPresence = false) {
    const query = trackPresence ? '?presence=true' : '';
    return request<{
      document: DocumentItem;
      cursors?: CursorState[];
      collaborators?: ActiveCollaborator[];
    }>(`/documents/${docId}${query}`, userId);
  },

  leaveDocument(userId: string, docId: string, clientId: string) {
    return request<{ left: boolean }>(`/documents/${docId}/leave`, userId, {
      method: 'POST',
      body: JSON.stringify({ clientId })
    });
  },

  sendCursor(
    userId: string,
    docId: string,
    payload: {
      clientId: string;
      selectionFrom?: number | null;
      selectionTo?: number | null;
      mouseXRatio?: number | null;
      mouseY?: number | null;
      isTyping?: boolean;
    }
  ) {
    return request<{ cursor: CursorState }>(`/documents/${docId}/cursor`, userId, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  createDocument(userId: string, payload: { title?: string; content?: string } = {}) {
    return request<{ document: DocumentItem }>('/documents', userId, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  updateDocument(
    userId: string,
    docId: string,
    payload: {
      title?: string;
      content?: string;
      clientId?: string;
      selectionFrom?: number | null;
      selectionTo?: number | null;
      createVersion?: boolean;
      versionSummary?: string;
    }
  ) {
    return request<{ document: DocumentItem }>(`/documents/${docId}`, userId, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },

  deleteDocument(userId: string, docId: string) {
    return request<{ deleted: boolean; id: string }>(`/documents/${docId}`, userId, {
      method: 'DELETE'
    });
  },

  uploadFile(
    userId: string,
    file: File,
    options: { mode?: 'create' | 'extract'; title?: string } = {}
  ) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', options.mode || 'create');
    if (options.title) {
      formData.append('title', options.title);
    }

    return request<{
      document?: DocumentItem;
      parsed: {
        inferredTitle: string;
        htmlContent: string;
        originalFilename: string;
        extension: string;
      };
    }>('/documents/upload', userId, {
      method: 'POST',
      body: formData
    });
  },

  shareDocument(
    userId: string,
    docId: string,
    payload: { email?: string; userId?: string; role: ShareRole }
  ) {
    return request<{ document: DocumentItem; shares: ShareDetail[] }>(
      `/documents/${docId}/shares`,
      userId,
      {
        method: 'POST',
        body: JSON.stringify(payload)
      }
    );
  },

  revokeShare(userId: string, docId: string, shareId: string) {
    return request<{ document: DocumentItem; shares: ShareDetail[] }>(
      `/documents/${docId}/shares/${shareId}`,
      userId,
      {
        method: 'DELETE'
      }
    );
  },

  // Version History API
  listVersions(userId: string, docId: string) {
    return request<{ versions: DocumentVersion[] }>(
      `/documents/${docId}/versions`,
      userId
    );
  },

  createVersion(userId: string, docId: string, summary?: string) {
    return request<{ versions: DocumentVersion[] }>(
      `/documents/${docId}/versions`,
      userId,
      {
        method: 'POST',
        body: JSON.stringify({ summary })
      }
    );
  },

  restoreVersion(userId: string, docId: string, versionId: string) {
    return request<{ document: DocumentItem }>(
      `/documents/${docId}/versions/${versionId}/restore`,
      userId,
      {
        method: 'POST'
      }
    );
  },

  // Comments & Suggestions API
  listComments(userId: string, docId: string) {
    return request<{ comments: DocumentComment[] }>(
      `/documents/${docId}/comments`,
      userId
    );
  },

  createComment(
    userId: string,
    docId: string,
    payload: {
      type: CommentType;
      quoted_text?: string | null;
      content: string;
    }
  ) {
    return request<{ comments: DocumentComment[] }>(
      `/documents/${docId}/comments`,
      userId,
      {
        method: 'POST',
        body: JSON.stringify(payload)
      }
    );
  },

  resolveComment(
    userId: string,
    docId: string,
    commentId: string,
    resolved: boolean
  ) {
    return request<{ comments: DocumentComment[] }>(
      `/documents/${docId}/comments/${commentId}`,
      userId,
      {
        method: 'PATCH',
        body: JSON.stringify({ resolved })
      }
    );
  },

  deleteComment(userId: string, docId: string, commentId: string) {
    return request<{ comments: DocumentComment[] }>(
      `/documents/${docId}/comments/${commentId}`,
      userId,
      {
        method: 'DELETE'
      }
    );
  }
};
