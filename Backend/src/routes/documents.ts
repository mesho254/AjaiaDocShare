import { Router } from 'express';
import crypto from 'node:crypto';
import multer from 'multer';
import { z } from 'zod';
import { getDb } from '../db/database.js';
import {
  DocumentComment,
  DocumentVersion,
  DocumentWithAccess,
  EffectiveRole,
  ShareDetail,
  ShareRole,
  User
} from '../db/types.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  MAX_FILE_SIZE_BYTES,
  parseUploadedFile,
  sanitizeRichText
} from '../services/fileParser.js';
import { realtimeHub } from '../services/realtimeHub.js';

export const documentsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES
  }
});

const CreateDocSchema = z.object({
  title: z.string().trim().max(200).optional(),
  content: z.string().optional()
});

const UpdateDocSchema = z
  .object({
    title: z.string().trim().min(1, 'Title cannot be empty').max(200).optional(),
    content: z.string().optional(),
    clientId: z.string().optional(),
    selectionFrom: z.number().nullable().optional(),
    selectionTo: z.number().nullable().optional(),
    createVersion: z.boolean().optional(),
    versionSummary: z.string().trim().max(200).optional()
  })
  .refine((data) => data.title !== undefined || data.content !== undefined, {
    message: 'At least one of title or content must be provided'
  });

const CreateCommentSchema = z.object({
  type: z.enum(['comment', 'suggestion']).default('comment'),
  quoted_text: z.string().trim().max(500).nullable().optional(),
  content: z.string().trim().min(1, 'Comment or suggestion text is required').max(2000)
});

const ResolveCommentSchema = z.object({
  resolved: z.boolean()
});

const CreateVersionSchema = z.object({
  summary: z.string().trim().max(200).optional()
});

const ShareDocSchema = z.object({
  email: z.string().trim().email('Please provide a valid email address').optional(),
  userId: z.string().trim().min(1).optional(),
  role: z.enum(['editor', 'viewer']).default('editor')
}).refine((data) => Boolean(data.email || data.userId), {
  message: 'Either email or userId is required to share a document'
});

const CursorUpdateSchema = z.object({
  clientId: z.string().min(1),
  selectionFrom: z.number().nullable().optional(),
  selectionTo: z.number().nullable().optional(),
  mouseXRatio: z.number().min(0).max(1).nullable().optional(),
  mouseY: z.number().nullable().optional(),
  isTyping: z.boolean().optional()
});

interface RawDocRow {
  id: string;
  title: string;
  content: string;
  owner_id: string;
  source_filename: string | null;
  created_at: string;
  updated_at: string;
  owner_name: string;
  owner_email: string;
  owner_avatar_color: string;
  shared_role: ShareRole | null;
}

function getDocumentShares(documentId: string): ShareDetail[] {
  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT
        ds.id,
        ds.document_id,
        ds.user_id,
        u.name AS user_name,
        u.email AS user_email,
        u.avatar_color,
        ds.role,
        ds.created_at
      FROM document_shares ds
      JOIN users u ON u.id = ds.user_id
      WHERE ds.document_id = ?
      ORDER BY ds.created_at ASC
    `
    )
    .all(documentId) as unknown as ShareDetail[];

  return rows;
}

function recordVersionSnapshot(
  docId: string,
  title: string,
  content: string,
  authorId: string,
  summary: string,
  force = false
): void {
  const db = getDb();
  const latest = db
    .prepare(
      `
      SELECT content, created_at
      FROM document_versions
      WHERE document_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `
    )
    .get(docId) as { content: string; created_at: string } | undefined;

  if (!force && latest) {
    const elapsedMs = Date.now() - new Date(latest.created_at).getTime();
    if (latest.content === content || elapsedMs < 45000) {
      return;
    }
  }

  const versionId = `ver-${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  db.prepare(
    `
    INSERT INTO document_versions (id, document_id, title, content, author_id, summary, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `
  ).run(versionId, docId, title, content, authorId, summary, now);
}

function getDocumentWithAccessCheck(docId: string, userId: string): DocumentWithAccess {
  const db = getDb();

  const row = db
    .prepare(
      `
      SELECT
        d.id,
        d.title,
        d.content,
        d.owner_id,
        d.source_filename,
        d.created_at,
        d.updated_at,
        u.name AS owner_name,
        u.email AS owner_email,
        u.avatar_color AS owner_avatar_color,
        ds.role AS shared_role
      FROM documents d
      JOIN users u ON u.id = d.owner_id
      LEFT JOIN document_shares ds ON ds.document_id = d.id AND ds.user_id = ?
      WHERE d.id = ?
    `
    )
    .get(userId, docId) as RawDocRow | undefined;

  if (!row) {
    throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'Document not found.');
  }

  let accessRole: EffectiveRole | null = null;
  if (row.owner_id === userId) {
    accessRole = 'owner';
  } else if (row.shared_role) {
    accessRole = row.shared_role;
  }

  if (!accessRole) {
    throw new AppError(
      403,
      'FORBIDDEN_DOCUMENT_ACCESS',
      'You do not have permission to access this document.'
    );
  }

  const commentCountRow = db
    .prepare(
      'SELECT COUNT(*) as count FROM document_comments WHERE document_id = ? AND resolved = 0'
    )
    .get(row.id) as { count: number };

  const versionCountRow = db
    .prepare('SELECT COUNT(*) as count FROM document_versions WHERE document_id = ?')
    .get(row.id) as { count: number };

  return {
    id: row.id,
    title: row.title,
    content: row.content,
    owner_id: row.owner_id,
    source_filename: row.source_filename,
    created_at: row.created_at,
    updated_at: row.updated_at,
    owner_name: row.owner_name,
    owner_email: row.owner_email,
    owner_avatar_color: row.owner_avatar_color,
    access_role: accessRole,
    shares: getDocumentShares(row.id),
    comment_count: commentCountRow.count,
    version_count: versionCountRow.count
  };
}

// GET /api/documents?filter=all|owned|shared&search=...
documentsRouter.get('/', (req, res, next) => {
  try {
    const userId = req.currentUser!.id;
    const filter = (req.query.filter as string) || 'all';
    const search = ((req.query.search as string) || '').trim().toLowerCase();
    const db = getDb();

    const rows = db
      .prepare(
        `
        SELECT
          d.id,
          d.title,
          d.content,
          d.owner_id,
          d.source_filename,
          d.created_at,
          d.updated_at,
          u.name AS owner_name,
          u.email AS owner_email,
          u.avatar_color AS owner_avatar_color,
          ds.role AS shared_role
        FROM documents d
        JOIN users u ON u.id = d.owner_id
        LEFT JOIN document_shares ds ON ds.document_id = d.id AND ds.user_id = ?
        WHERE (d.owner_id = ? OR ds.user_id = ?)
        ORDER BY d.updated_at DESC
      `
      )
      .all(userId, userId, userId) as unknown as RawDocRow[];

    let documents: DocumentWithAccess[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      owner_id: row.owner_id,
      source_filename: row.source_filename,
      created_at: row.created_at,
      updated_at: row.updated_at,
      owner_name: row.owner_name,
      owner_email: row.owner_email,
      owner_avatar_color: row.owner_avatar_color,
      access_role: row.owner_id === userId ? 'owner' : (row.shared_role as ShareRole),
      shares: getDocumentShares(row.id)
    }));

    if (filter === 'owned') {
      documents = documents.filter((d) => d.access_role === 'owner');
    } else if (filter === 'shared') {
      documents = documents.filter((d) => d.access_role !== 'owner');
    }

    if (search) {
      documents = documents.filter(
        (d) =>
          d.title.toLowerCase().includes(search) ||
          d.owner_name.toLowerCase().includes(search)
      );
    }

    res.json({ documents });
  } catch (err) {
    next(err);
  }
});

// POST /api/documents — Create new blank or pre-populated document
documentsRouter.post('/', (req, res, next) => {
  try {
    const parsed = CreateDocSchema.parse(req.body || {});
    const userId = req.currentUser!.id;
    const db = getDb();

    const id = `doc-${crypto.randomUUID().slice(0, 8)}`;
    const title = parsed.title && parsed.title.length > 0 ? parsed.title : 'Untitled Document';
    const content = parsed.content ? sanitizeRichText(parsed.content) : '<p></p>';
    const now = new Date().toISOString();

    db.prepare(
      `
      INSERT INTO documents (id, title, content, owner_id, source_filename, created_at, updated_at)
      VALUES (?, ?, ?, ?, NULL, ?, ?)
    `
    ).run(id, title, content, userId, now, now);

    recordVersionSnapshot(id, title, content, userId, 'Initial document created', true);

    const createdDoc = getDocumentWithAccessCheck(id, userId);
    res.status(201).json({ document: createdDoc });
  } catch (err) {
    next(err);
  }
});

// POST /api/documents/upload — Upload .txt, .md, or .docx file
documentsRouter.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError(400, 'MISSING_FILE', 'Please select a .txt, .md, or .docx file to upload.');
    }

    const mode = (req.body?.mode as string) || 'create';
    const customTitle = (req.body?.title as string | undefined)?.trim();
    const parsedFile = await parseUploadedFile(req.file.originalname, req.file.buffer);

    if (mode === 'extract') {
      res.status(200).json({
        parsed: parsedFile
      });
      return;
    }

    const userId = req.currentUser!.id;
    const db = getDb();
    const id = `doc-${crypto.randomUUID().slice(0, 8)}`;
    const finalTitle = customTitle || parsedFile.inferredTitle || 'Imported Document';
    const now = new Date().toISOString();

    db.prepare(
      `
      INSERT INTO documents (id, title, content, owner_id, source_filename, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      id,
      finalTitle,
      parsedFile.htmlContent,
      userId,
      parsedFile.originalFilename,
      now,
      now
    );

    recordVersionSnapshot(
      id,
      finalTitle,
      parsedFile.htmlContent,
      userId,
      `Imported from ${parsedFile.originalFilename}`,
      true
    );

    const createdDoc = getDocumentWithAccessCheck(id, userId);
    res.status(201).json({
      document: createdDoc,
      parsed: parsedFile
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/documents/:id/stream — Real-time SSE collaboration & presence stream
documentsRouter.get('/:id/stream', (req, res, next) => {
  try {
    const user = req.currentUser!;
    const doc = getDocumentWithAccessCheck(req.params.id, user.id);
    const clientId =
      (typeof req.query.clientId === 'string' && req.query.clientId.trim()) ||
      crypto.randomUUID();
    const connectionId = crypto.randomUUID();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    realtimeHub.addClient(doc.id, connectionId, clientId, user, res);

    const keepAlive = setInterval(() => {
      try {
        res.write(': keep-alive\n\n');
      } catch {
        clearInterval(keepAlive);
      }
    }, 10000);

    req.on('close', () => {
      clearInterval(keepAlive);
      realtimeHub.removeClient(doc.id, connectionId);
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/documents/:id/cursor — Broadcast live cursor/caret and mouse pointer coordinates
documentsRouter.post('/:id/cursor', (req, res, next) => {
  try {
    const parsed = CursorUpdateSchema.parse(req.body);
    const user = req.currentUser!;
    const doc = getDocumentWithAccessCheck(req.params.id, user.id);

    const cursor = realtimeHub.updateCursor(doc.id, parsed.clientId, user, {
      selectionFrom: parsed.selectionFrom,
      selectionTo: parsed.selectionTo,
      mouseXRatio: parsed.mouseXRatio,
      mouseY: parsed.mouseY,
      isTyping: parsed.isTyping
    });

    res.json({ cursor });
  } catch (err) {
    next(err);
  }
});

// POST /api/documents/:id/leave — Immediately remove collaborator cursor & presence on exit
documentsRouter.post('/:id/leave', (req, res, next) => {
  try {
    const user = req.currentUser!;
    const clientId =
      typeof req.body?.clientId === 'string' ? req.body.clientId : '';
    realtimeHub.leaveDocument(req.params.id, clientId, user.id);
    res.json({ left: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/documents/:id
documentsRouter.get('/:id', (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    const doc = getDocumentWithAccessCheck(req.params.id, req.currentUser!.id);
    if (req.query.presence === 'true') {
      realtimeHub.recordHeartbeat(doc.id, req.currentUser!);
    }
    const cursors = realtimeHub.getCursors(doc.id);
    const collaborators = realtimeHub.getCollaborators(doc.id);
    res.json({ document: doc, cursors, collaborators });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/documents/:id — Update title or content (Owner or Editor only)
documentsRouter.patch('/:id', (req, res, next) => {
  try {
    const parsed = UpdateDocSchema.parse(req.body);
    const userId = req.currentUser!.id;
    const existing = getDocumentWithAccessCheck(req.params.id, userId);

    if (existing.access_role === 'viewer') {
      throw new AppError(
        403,
        'READ_ONLY_ACCESS',
        'You have View Only access to this document and cannot save changes.'
      );
    }

    const nextTitle = parsed.title !== undefined ? parsed.title : existing.title;
    const nextContent =
      parsed.content !== undefined ? sanitizeRichText(parsed.content) : existing.content;
    const now = new Date().toISOString();

    const db = getDb();
    db.prepare(
      `
      UPDATE documents
      SET title = ?, content = ?, updated_at = ?
      WHERE id = ?
    `
    ).run(nextTitle, nextContent, now, existing.id);

    recordVersionSnapshot(
      existing.id,
      nextTitle,
      nextContent,
      userId,
      parsed.versionSummary ||
        (parsed.createVersion
          ? `Saved checkpoint by ${req.currentUser!.name}`
          : `Edited by ${req.currentUser!.name}`),
      Boolean(parsed.createVersion)
    );

    const updated = getDocumentWithAccessCheck(existing.id, userId);

    if (parsed.clientId) {
      realtimeHub.updateCursor(existing.id, parsed.clientId, req.currentUser!, {
        selectionFrom: parsed.selectionFrom,
        selectionTo: parsed.selectionTo,
        isTyping: true
      });
    }

    // Broadcast live edit to all other open windows/collaborators viewing this document
    realtimeHub.broadcastDocumentUpdate(existing.id, {
      title: updated.title,
      content: updated.content,
      updated_at: updated.updated_at,
      updatedBy: req.currentUser!,
      sourceClientId: parsed.clientId
    });

    res.json({ document: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/documents/:id — Owner only
documentsRouter.delete('/:id', (req, res, next) => {
  try {
    const userId = req.currentUser!.id;
    const existing = getDocumentWithAccessCheck(req.params.id, userId);

    if (existing.access_role !== 'owner') {
      throw new AppError(
        403,
        'OWNER_REQUIRED',
        'Only the document owner can delete this document.'
      );
    }

    const db = getDb();
    db.prepare('DELETE FROM documents WHERE id = ?').run(existing.id);

    res.json({ deleted: true, id: existing.id });
  } catch (err) {
    next(err);
  }
});

// POST /api/documents/:id/shares — Share document with another user (Owner only)
documentsRouter.post('/:id/shares', (req, res, next) => {
  try {
    const parsed = ShareDocSchema.parse(req.body);
    const userId = req.currentUser!.id;
    const existing = getDocumentWithAccessCheck(req.params.id, userId);

    if (existing.access_role !== 'owner') {
      throw new AppError(
        403,
        'OWNER_REQUIRED',
        'Only the document owner can manage sharing permissions.'
      );
    }

    const db = getDb();
    let targetUser: User | undefined;

    if (parsed.userId) {
      targetUser = db
        .prepare('SELECT id, name, email, role_title, avatar_color, created_at FROM users WHERE id = ?')
        .get(parsed.userId) as User | undefined;
    } else if (parsed.email) {
      targetUser = db
        .prepare(
          'SELECT id, name, email, role_title, avatar_color, created_at FROM users WHERE LOWER(email) = LOWER(?)'
        )
        .get(parsed.email) as User | undefined;
    }

    if (!targetUser) {
      throw new AppError(
        404,
        'USER_NOT_FOUND',
        `No user found matching '${parsed.email || parsed.userId}'. Try one of the team members (alice@ajaia.io, liam@ajaia.io, maya@ajaia.io).`
      );
    }

    if (targetUser.id === existing.owner_id) {
      throw new AppError(
        400,
        'CANNOT_SHARE_WITH_OWNER',
        'You are already the owner of this document.'
      );
    }

    const existingShare = db
      .prepare('SELECT id FROM document_shares WHERE document_id = ? AND user_id = ?')
      .get(existing.id, targetUser.id) as { id: string } | undefined;

    const now = new Date().toISOString();

    if (existingShare) {
      db.prepare('UPDATE document_shares SET role = ? WHERE id = ?').run(
        parsed.role,
        existingShare.id
      );
    } else {
      const shareId = `share-${crypto.randomUUID().slice(0, 8)}`;
      db.prepare(
        `
        INSERT INTO document_shares (id, document_id, user_id, role, created_at)
        VALUES (?, ?, ?, ?, ?)
      `
      ).run(shareId, existing.id, targetUser.id, parsed.role, now);
    }

    const updated = getDocumentWithAccessCheck(existing.id, userId);
    res.status(201).json({
      document: updated,
      shares: updated.shares
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/documents/:id/shares/:shareId — Revoke share (Owner only)
documentsRouter.delete('/:id/shares/:shareId', (req, res, next) => {
  try {
    const userId = req.currentUser!.id;
    const existing = getDocumentWithAccessCheck(req.params.id, userId);

    if (existing.access_role !== 'owner') {
      throw new AppError(
        403,
        'OWNER_REQUIRED',
        'Only the document owner can revoke access.'
      );
    }

    const db = getDb();
    const result = db
      .prepare('DELETE FROM document_shares WHERE id = ? AND document_id = ?')
      .run(req.params.shareId, existing.id);

    if (result.changes === 0) {
      throw new AppError(404, 'SHARE_NOT_FOUND', 'Share record not found.');
    }

    const updated = getDocumentWithAccessCheck(existing.id, userId);
    res.json({
      document: updated,
      shares: updated.shares
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// VERSION HISTORY ENDPOINTS (Stretch Feature)
// ============================================================================

// GET /api/documents/:id/versions — List version snapshots
documentsRouter.get('/:id/versions', (req, res, next) => {
  try {
    const doc = getDocumentWithAccessCheck(req.params.id, req.currentUser!.id);
    const db = getDb();

    const versions = db
      .prepare(
        `
        SELECT
          dv.id,
          dv.document_id,
          dv.title,
          dv.content,
          dv.author_id,
          u.name AS author_name,
          u.email AS author_email,
          u.avatar_color AS author_avatar_color,
          dv.summary,
          dv.created_at
        FROM document_versions dv
        JOIN users u ON u.id = dv.author_id
        WHERE dv.document_id = ?
        ORDER BY dv.created_at DESC
      `
      )
      .all(doc.id) as unknown as DocumentVersion[];

    res.json({ versions });
  } catch (err) {
    next(err);
  }
});

// POST /api/documents/:id/versions — Save an explicit version snapshot (Owner or Editor)
documentsRouter.post('/:id/versions', (req, res, next) => {
  try {
    const parsed = CreateVersionSchema.parse(req.body || {});
    const user = req.currentUser!;
    const doc = getDocumentWithAccessCheck(req.params.id, user.id);

    if (doc.access_role === 'viewer') {
      throw new AppError(
        403,
        'READ_ONLY_ACCESS',
        'Viewers cannot create version snapshots.'
      );
    }

    recordVersionSnapshot(
      doc.id,
      doc.title,
      doc.content,
      user.id,
      parsed.summary || `Manual snapshot by ${user.name}`,
      true
    );

    const db = getDb();
    const versions = db
      .prepare(
        `
        SELECT
          dv.id,
          dv.document_id,
          dv.title,
          dv.content,
          dv.author_id,
          u.name AS author_name,
          u.email AS author_email,
          u.avatar_color AS author_avatar_color,
          dv.summary,
          dv.created_at
        FROM document_versions dv
        JOIN users u ON u.id = dv.author_id
        WHERE dv.document_id = ?
        ORDER BY dv.created_at DESC
      `
      )
      .all(doc.id) as unknown as DocumentVersion[];

    res.status(201).json({ versions });
  } catch (err) {
    next(err);
  }
});

// POST /api/documents/:id/versions/:versionId/restore — Restore a historical version
documentsRouter.post('/:id/versions/:versionId/restore', (req, res, next) => {
  try {
    const user = req.currentUser!;
    const doc = getDocumentWithAccessCheck(req.params.id, user.id);

    if (doc.access_role === 'viewer') {
      throw new AppError(
        403,
        'READ_ONLY_ACCESS',
        'Viewers cannot restore document versions.'
      );
    }

    const db = getDb();
    const targetVersion = db
      .prepare(
        'SELECT id, title, content, created_at FROM document_versions WHERE id = ? AND document_id = ?'
      )
      .get(req.params.versionId, doc.id) as
      | { id: string; title: string; content: string; created_at: string }
      | undefined;

    if (!targetVersion) {
      throw new AppError(404, 'VERSION_NOT_FOUND', 'Version snapshot not found.');
    }

    const now = new Date().toISOString();
    db.prepare(
      'UPDATE documents SET title = ?, content = ?, updated_at = ? WHERE id = ?'
    ).run(targetVersion.title, targetVersion.content, now, doc.id);

    recordVersionSnapshot(
      doc.id,
      targetVersion.title,
      targetVersion.content,
      user.id,
      `Restored version from ${new Date(targetVersion.created_at).toLocaleTimeString()}`,
      true
    );

    const updated = getDocumentWithAccessCheck(doc.id, user.id);

    realtimeHub.broadcastDocumentUpdate(doc.id, {
      title: updated.title,
      content: updated.content,
      updated_at: updated.updated_at,
      updatedBy: user
    });

    res.json({ document: updated });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// COMMENTS & SUGGESTIONS ENDPOINTS (Stretch Feature)
// ============================================================================

function listCommentsForDoc(docId: string): DocumentComment[] {
  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT
        dc.id,
        dc.document_id,
        dc.author_id,
        u.name AS author_name,
        u.email AS author_email,
        u.avatar_color AS author_avatar_color,
        dc.type,
        dc.quoted_text,
        dc.content,
        dc.resolved,
        dc.created_at
      FROM document_comments dc
      JOIN users u ON u.id = dc.author_id
      WHERE dc.document_id = ?
      ORDER BY dc.created_at DESC
    `
    )
    .all(docId) as unknown as Array<
    Omit<DocumentComment, 'resolved'> & { resolved: number }
  >;

  return rows.map((r) => ({
    ...r,
    resolved: Boolean(r.resolved)
  }));
}

// GET /api/documents/:id/comments — List comments and suggestions
documentsRouter.get('/:id/comments', (req, res, next) => {
  try {
    const doc = getDocumentWithAccessCheck(req.params.id, req.currentUser!.id);
    res.json({ comments: listCommentsForDoc(doc.id) });
  } catch (err) {
    next(err);
  }
});

// POST /api/documents/:id/comments — Add a comment or suggestion (Owner, Editor, or Viewer!)
documentsRouter.post('/:id/comments', (req, res, next) => {
  try {
    const parsed = CreateCommentSchema.parse(req.body);
    const user = req.currentUser!;
    const doc = getDocumentWithAccessCheck(req.params.id, user.id);

    const id = `comment-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const db = getDb();

    db.prepare(
      `
      INSERT INTO document_comments (id, document_id, author_id, type, quoted_text, content, resolved, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `
    ).run(
      id,
      doc.id,
      user.id,
      parsed.type,
      parsed.quoted_text || null,
      parsed.content,
      now
    );

    res.status(201).json({ comments: listCommentsForDoc(doc.id) });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/documents/:id/comments/:commentId — Resolve or reopen a comment/suggestion
documentsRouter.patch('/:id/comments/:commentId', (req, res, next) => {
  try {
    const parsed = ResolveCommentSchema.parse(req.body);
    const user = req.currentUser!;
    const doc = getDocumentWithAccessCheck(req.params.id, user.id);

    const db = getDb();
    const result = db
      .prepare(
        'UPDATE document_comments SET resolved = ? WHERE id = ? AND document_id = ?'
      )
      .run(parsed.resolved ? 1 : 0, req.params.commentId, doc.id);

    if (result.changes === 0) {
      throw new AppError(404, 'COMMENT_NOT_FOUND', 'Comment not found.');
    }

    res.json({ comments: listCommentsForDoc(doc.id) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/documents/:id/comments/:commentId — Delete a comment (Author or Document Owner)
documentsRouter.delete('/:id/comments/:commentId', (req, res, next) => {
  try {
    const user = req.currentUser!;
    const doc = getDocumentWithAccessCheck(req.params.id, user.id);
    const db = getDb();

    const comment = db
      .prepare(
        'SELECT id, author_id FROM document_comments WHERE id = ? AND document_id = ?'
      )
      .get(req.params.commentId, doc.id) as
      | { id: string; author_id: string }
      | undefined;

    if (!comment) {
      throw new AppError(404, 'COMMENT_NOT_FOUND', 'Comment not found.');
    }

    if (comment.author_id !== user.id && doc.access_role !== 'owner') {
      throw new AppError(
        403,
        'FORBIDDEN',
        'Only the comment author or document owner can delete this comment.'
      );
    }

    db.prepare('DELETE FROM document_comments WHERE id = ?').run(comment.id);

    res.json({ comments: listCommentsForDoc(doc.id) });
  } catch (err) {
    next(err);
  }
});
