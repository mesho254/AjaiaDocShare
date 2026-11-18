import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: typeof DatabaseSyncType;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbInstance: DatabaseSyncType | null = null;

export function getDb(): DatabaseSyncType {
  if (dbInstance) {
    return dbInstance;
  }

  const envPath = process.env.DB_PATH;
  let resolvedPath: string;

  if (envPath === ':memory:') {
    resolvedPath = ':memory:';
  } else {
    const dataDir = path.resolve(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    resolvedPath = envPath ? path.resolve(envPath) : path.join(dataDir, 'ajaia.db');
  }

  dbInstance = new DatabaseSync(resolvedPath);
  dbInstance.exec('PRAGMA foreign_keys = ON;');
  if (resolvedPath !== ':memory:') {
    dbInstance.exec('PRAGMA journal_mode = WAL;');
  }

  initSchema(dbInstance);
  seedIfEmpty(dbInstance);
  seedStretchDataIfEmpty(dbInstance);

  return dbInstance;
}

export function resetDbForTesting(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
  getDb();
}

function initSchema(db: DatabaseSyncType): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role_title TEXT NOT NULL DEFAULT 'Team Member',
      avatar_color TEXT NOT NULL DEFAULT '#4f46e5',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      owner_id TEXT NOT NULL,
      source_filename TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS document_shares (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
      created_at TEXT NOT NULL,
      UNIQUE(document_id, user_id),
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS document_versions (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      author_id TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT 'Saved version',
      created_at TEXT NOT NULL,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS document_comments (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'comment' CHECK (type IN ('comment', 'suggestion')),
      quoted_text TEXT,
      content TEXT NOT NULL,
      resolved INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
}

function seedIfEmpty(db: DatabaseSyncType): void {
  const countRow = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (countRow.count > 0) {
    return;
  }

  const now = new Date().toISOString();

  const insertUser = db.prepare(`
    INSERT INTO users (id, name, email, role_title, avatar_color, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertUser.run('user-alice', 'Alice Rivera', 'alice@ajaia.io', 'Product Lead', '#4f46e5', now);
  insertUser.run('user-liam', 'Liam Chen', 'liam@ajaia.io', 'Staff Engineer', '#059669', now);
  insertUser.run('user-maya', 'Maya Patel', 'maya@ajaia.io', 'Product Designer', '#d97706', now);

  const insertDoc = db.prepare(`
    INSERT INTO documents (id, title, content, owner_id, source_filename, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertDoc.run(
    'doc-roadmap',
    'Q4 Product Roadmap — AI Workspace',
    `<h1>Q4 Product Roadmap — AI Workspace</h1>
<p>Welcome to <strong>Ajaia Docs</strong>! This collaborative workspace lets teams draft, format, import, and share living documents with clear access boundaries.</p>
<h2>Core Milestones</h2>
<ul>
  <li><strong>Rich-Text Authoring:</strong> Support headings, bold, italic, underline, and structured lists with automatic cloud persistence.</li>
  <li><strong>Seamless File Import:</strong> Convert existing <em>.md</em>, <em>.txt</em>, and <em>.docx</em> notes directly into editable documents.</li>
  <li><strong>Role-Based Sharing:</strong> Grant teammates either <u>Editor</u> or <u>Viewer</u> permissions with instant visibility.</li>
</ul>
<h2>Launch Checklist</h2>
<ol>
  <li>Finalize core document editor toolbar and keyboard shortcuts</li>
  <li>Verify multi-user sharing permissions across owned and shared tabs</li>
  <li>Complete end-to-end automated integration tests</li>
</ol>`,
    'user-alice',
    null,
    now,
    now
  );

  insertDoc.run(
    'doc-architecture',
    'Engineering Architecture & Security RFC',
    `<h1>Engineering Architecture & Security RFC</h1>
<p>This document outlines the persistence and access-control architecture for internal productivity tools at Ajaia.</p>
<h2>1. Access Control Model</h2>
<p>Every document has an immutable <strong>Owner</strong> and zero or more shared collaborators. Collaborators are assigned one of two roles:</p>
<ul>
  <li><strong>Editor:</strong> Can read and modify document title and rich-text body, but cannot delete the document or alter ownership.</li>
  <li><strong>Viewer:</strong> Read-only access. Attempts to mutate content via UI or API return <em>403 Forbidden</em>.</li>
</ul>
<h2>2. File Import Pipeline</h2>
<p>Uploaded files are validated for extension and size (max 5 MB), converted in-memory to semantic HTML, and sanitized before persistence.</p>`,
    'user-liam',
    'architecture-rfc.md',
    now,
    now
  );

  insertDoc.run(
    'doc-design',
    'Design System & Typography Guidelines',
    `<h1>Design System & Typography Guidelines</h1>
<p>Shared with you in <strong>View Only</strong> mode to demonstrate read-only permission enforcement.</p>
<h2>Typography Hierarchy</h2>
<ul>
  <li><strong>Heading 1:</strong> Document Title &amp; Primary Sections</li>
  <li><strong>Heading 2:</strong> Major Subsections</li>
  <li><strong>Heading 3:</strong> Supporting Topic Headers</li>
</ul>
<p>Switch to <em>Maya Patel</em> using the persona switcher in the top navigation bar if you want to edit or manage sharing on this document.</p>`,
    'user-maya',
    null,
    now,
    now
  );

  const insertShare = db.prepare(`
    INSERT INTO document_shares (id, document_id, user_id, role, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertShare.run('share-1', 'doc-roadmap', 'user-liam', 'editor', now);
  insertShare.run('share-2', 'doc-roadmap', 'user-maya', 'viewer', now);
  insertShare.run('share-3', 'doc-architecture', 'user-alice', 'editor', now);
  insertShare.run('share-4', 'doc-design', 'user-alice', 'viewer', now);
}

function seedStretchDataIfEmpty(db: DatabaseSyncType): void {
  const versionCount = db
    .prepare('SELECT COUNT(*) as count FROM document_versions')
    .get() as { count: number };

  if (versionCount.count === 0) {
    const docs = db
      .prepare('SELECT id, title, content, owner_id, created_at FROM documents')
      .all() as Array<{
      id: string;
      title: string;
      content: string;
      owner_id: string;
      created_at: string;
    }>;

    const insertVersion = db.prepare(`
      INSERT INTO document_versions (id, document_id, title, content, author_id, summary, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const d of docs) {
      insertVersion.run(
        `ver-init-${d.id}`,
        d.id,
        d.title,
        d.content,
        d.owner_id,
        'Initial document version',
        d.created_at
      );
    }
  }

  const commentCount = db
    .prepare('SELECT COUNT(*) as count FROM document_comments')
    .get() as { count: number };

  if (commentCount.count === 0) {
    const now = new Date().toISOString();
    const docExists = db
      .prepare('SELECT id FROM documents WHERE id = ?')
      .get('doc-roadmap') as { id: string } | undefined;

    if (docExists) {
      const insertComment = db.prepare(`
        INSERT INTO document_comments (id, document_id, author_id, type, quoted_text, content, resolved, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertComment.run(
        'comment-seed-1',
        'doc-roadmap',
        'user-liam',
        'comment',
        'Role-Based Sharing',
        'Backend RBAC enforcement and live cursor sync are verified and passing all integration tests.',
        0,
        now
      );

      insertComment.run(
        'comment-seed-2',
        'doc-roadmap',
        'user-maya',
        'suggestion',
        'living documents with clear access boundaries.',
        'living documents with real-time cursors, version history, and clear access boundaries.',
        0,
        now
      );
    }
  }
}
