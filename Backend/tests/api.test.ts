import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { resetDbForTesting } from '../src/db/database.js';

process.env.DB_PATH = ':memory:';

describe('Ajaia Docs API Integration Suite', () => {
  const app = createApp();

  beforeEach(() => {
    resetDbForTesting();
  });

  it('1. Lists seeded users and resolves active user from x-user-id header', async () => {
    const res = await request(app).get('/api/users').set('x-user-id', 'user-liam');

    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(3);
    expect(res.body.currentUser.id).toBe('user-liam');
    expect(res.body.currentUser.email).toBe('liam@ajaia.io');
  });

  it('2. Creates, renames, updates rich-text HTML, and persists a document across reads', async () => {
    const createRes = await request(app)
      .post('/api/documents')
      .set('x-user-id', 'user-alice')
      .send({
        title: 'Sprint Planning Notes',
        content: '<h1>Sprint Goals</h1><p>Ship <strong>collaborative</strong> editor.</p>'
      });

    expect(createRes.status).toBe(201);
    const docId = createRes.body.document.id;
    expect(createRes.body.document.title).toBe('Sprint Planning Notes');
    expect(createRes.body.document.access_role).toBe('owner');

    // Update title & rich-text formatting
    const patchRes = await request(app)
      .patch(`/api/documents/${docId}`)
      .set('x-user-id', 'user-alice')
      .send({
        title: 'Sprint Planning Notes (Updated)',
        content:
          '<h1>Sprint Goals</h1><ul><li>Support <u>underline</u> and <em>italic</em></li></ul><script>alert("xss")</script>'
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.document.title).toBe('Sprint Planning Notes (Updated)');
    expect(patchRes.body.document.content).toContain('<u>underline</u>');
    expect(patchRes.body.document.content).not.toContain('<script>');

    // Reopen document
    const getRes = await request(app)
      .get(`/api/documents/${docId}`)
      .set('x-user-id', 'user-alice');

    expect(getRes.status).toBe(200);
    expect(getRes.body.document.title).toBe('Sprint Planning Notes (Updated)');
    expect(getRes.body.document.content).toContain('<ul><li>Support <u>underline</u>');
  });

  it('3. Enforces role-based sharing access control (Owner vs Editor vs Viewer vs Unshared)', async () => {
    // Alice creates a private document
    const createRes = await request(app)
      .post('/api/documents')
      .set('x-user-id', 'user-alice')
      .send({ title: 'Confidential Launch Plan', content: '<p>Initial draft</p>' });

    const docId = createRes.body.document.id;

    // Unshared user (Liam) is blocked from reading (403 Forbidden)
    const unsharedRead = await request(app)
      .get(`/api/documents/${docId}`)
      .set('x-user-id', 'user-liam');
    expect(unsharedRead.status).toBe(403);

    // Alice shares with Maya as Viewer ('viewer') and Liam as Editor ('editor')
    const shareMaya = await request(app)
      .post(`/api/documents/${docId}/shares`)
      .set('x-user-id', 'user-alice')
      .send({ email: 'maya@ajaia.io', role: 'viewer' });
    expect(shareMaya.status).toBe(201);

    const shareLiam = await request(app)
      .post(`/api/documents/${docId}/shares`)
      .set('x-user-id', 'user-alice')
      .send({ email: 'liam@ajaia.io', role: 'editor' });
    expect(shareLiam.status).toBe(201);

    // Maya (Viewer) can read the document in her 'shared' list, but CANNOT edit it (403)
    const mayaSharedList = await request(app)
      .get('/api/documents?filter=shared')
      .set('x-user-id', 'user-maya');
    expect(mayaSharedList.body.documents.some((d: { id: string }) => d.id === docId)).toBe(true);

    const mayaEditAttempt = await request(app)
      .patch(`/api/documents/${docId}`)
      .set('x-user-id', 'user-maya')
      .send({ content: '<p>Unauthorized viewer edit</p>' });
    expect(mayaEditAttempt.status).toBe(403);
    expect(mayaEditAttempt.body.error.code).toBe('READ_ONLY_ACCESS');

    // Liam (Editor) CAN edit content, but CANNOT delete the document (403)
    const liamEditAttempt = await request(app)
      .patch(`/api/documents/${docId}`)
      .set('x-user-id', 'user-liam')
      .send({ content: '<p>Approved editor update by Liam</p>' });
    expect(liamEditAttempt.status).toBe(200);
    expect(liamEditAttempt.body.document.content).toContain('Approved editor update by Liam');

    const liamDeleteAttempt = await request(app)
      .delete(`/api/documents/${docId}`)
      .set('x-user-id', 'user-liam');
    expect(liamDeleteAttempt.status).toBe(403);
  });

  it('4. Converts uploaded .md and .txt files into editable rich-text documents and rejects unsupported types', async () => {
    const markdownBuffer = Buffer.from(
      '# Product Requirements\n\nThis is **bold** and *italic* text.\n\n- First item\n- Second item\n',
      'utf-8'
    );

    const uploadMdRes = await request(app)
      .post('/api/documents/upload')
      .set('x-user-id', 'user-alice')
      .attach('file', markdownBuffer, 'product-requirements.md');

    expect(uploadMdRes.status).toBe(201);
    expect(uploadMdRes.body.document.title).toBe('product requirements');
    expect(uploadMdRes.body.document.source_filename).toBe('product-requirements.md');
    expect(uploadMdRes.body.document.content).toContain('<h1>Product Requirements</h1>');
    expect(uploadMdRes.body.document.content).toContain('<strong>bold</strong>');
    expect(uploadMdRes.body.document.content).toContain('<ul>');

    // Unsupported file extension (.exe) is rejected with 400
    const badFileRes = await request(app)
      .post('/api/documents/upload')
      .set('x-user-id', 'user-alice')
      .attach('file', Buffer.from('binary'), 'malware.exe');

    expect(badFileRes.status).toBe(400);
    expect(badFileRes.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
  });

  it('5. Serves OpenAPI 3.0 specification and Swagger UI documentation', async () => {
    const specRes = await request(app).get('/api/openapi.json');
    expect(specRes.status).toBe(200);
    expect(specRes.body.openapi).toBe('3.0.3');
    expect(specRes.body.paths['/api/documents']).toBeDefined();

    const swaggerHtmlRes = await request(app).get('/api/docs/');
    expect(swaggerHtmlRes.status).toBe(200);
    expect(swaggerHtmlRes.text).toContain('Ajaia Docs API — Swagger UI');
  });

  it('6. Supports Document Version History (create snapshot, list versions, and restore)', async () => {
    // Alice edits her roadmap doc and creates a version checkpoint
    const patchRes = await request(app)
      .patch('/api/documents/doc-roadmap')
      .set('x-user-id', 'user-alice')
      .send({
        title: 'Q4 Product Roadmap — v2 Draft',
        content: '<h1>v2 Heading</h1><p>Updated content in v2</p>',
        createVersion: true,
        versionSummary: 'Milestone v2 update'
      });
    expect(patchRes.status).toBe(200);

    // List versions
    const versionsRes = await request(app)
      .get('/api/documents/doc-roadmap/versions')
      .set('x-user-id', 'user-alice');
    expect(versionsRes.status).toBe(200);
    expect(versionsRes.body.versions.length).toBeGreaterThanOrEqual(2);

    const initialVersion = versionsRes.body.versions.find(
      (v: { summary: string }) => v.summary === 'Initial document version'
    );
    expect(initialVersion).toBeDefined();

    // Restore initial version
    const restoreRes = await request(app)
      .post(`/api/documents/doc-roadmap/versions/${initialVersion.id}/restore`)
      .set('x-user-id', 'user-alice');
    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body.document.title).toBe('Q4 Product Roadmap — AI Workspace');
  });

  it('7. Supports Commenting and Suggestion Mode across Owner, Editor, and Viewer roles', async () => {
    // Maya has 'viewer' access on doc-roadmap — she can still post a suggestion!
    const createSuggestionRes = await request(app)
      .post('/api/documents/doc-roadmap/comments')
      .set('x-user-id', 'user-maya')
      .send({
        type: 'suggestion',
        quoted_text: 'Core Milestones',
        content: 'Key Q4 Milestones & Deliverables'
      });

    expect(createSuggestionRes.status).toBe(201);
    const created = createSuggestionRes.body.comments.find(
      (c: { content: string }) => c.content === 'Key Q4 Milestones & Deliverables'
    );
    expect(created).toBeDefined();
    expect(created.type).toBe('suggestion');
    expect(created.resolved).toBe(false);

    // Alice resolves the suggestion
    const resolveRes = await request(app)
      .patch(`/api/documents/doc-roadmap/comments/${created.id}`)
      .set('x-user-id', 'user-alice')
      .send({ resolved: true });
    expect(resolveRes.status).toBe(200);
    const resolvedItem = resolveRes.body.comments.find(
      (c: { id: string }) => c.id === created.id
    );
    expect(resolvedItem.resolved).toBe(true);
  });
});
