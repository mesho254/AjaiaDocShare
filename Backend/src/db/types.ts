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

export interface DocumentRecord {
  id: string;
  title: string;
  content: string;
  owner_id: string;
  source_filename: string | null;
  created_at: string;
  updated_at: string;
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

export interface DocumentWithAccess extends DocumentRecord {
  owner_name: string;
  owner_email: string;
  owner_avatar_color: string;
  access_role: EffectiveRole;
  shares: ShareDetail[];
  comment_count?: number;
  version_count?: number;
}
