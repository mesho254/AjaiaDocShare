# AI-Native Workflow Note

This note outlines how AI tools were integrated into the engineering workflow for **Ajaia Docs**, where AI provided leverage, where AI outputs were modified or rejected using engineering judgment, and how correctness was verified.

---

## 1. Which AI Tools Were Used
- **Antigravity (Agentic Coding Assistant):** Used for system architecture planning, scaffolding Express + TypeScript routes, generating SQLite schema & seed data, wiring TipTap toolbar controls, and authoring `Vitest + Supertest` integration tests.

---

## 2. Where AI Materially Sped Up Work
1. **Full-Stack Type & Route Scaffolding (~60% time saved):** Rapidly generated matching TypeScript interfaces (`User`, `DocumentWithAccess`, `ShareDetail`), Zod request validation schemas, and REST API client methods across `./Backend` and `./Frontend`.
2. **Multi-Format File Conversion Pipeline:** Accelerated the implementation of `fileParser.ts` combining `mammoth` (`.docx` to HTML), `marked` (`.md` to HTML), and `.txt` paragraph normalization with `sanitize-html`.
3. **Automated Security & RBAC Test Cases:** Quickly scaffolded multi-user `Supertest` scenarios testing `Owner`, `Editor`, `Viewer`, and unshared access transitions.

---

## 3. What AI-Generated Output Was Changed or Rejected

### Example 1: Preventing TipTap Cursor Reset During Auto-Save
- **Initial AI Pattern:** Passing `doc.content` directly into a reactive `useEffect` that called `editor.commands.setContent(doc.content)` whenever the parent `document` prop updated after an auto-save `PATCH` response.
- **Why It Was Rejected / Changed:** Calling `setContent()` while a user is actively typing resets the ProseMirror selection cursor to the end of the document and interrupts typing flow.
- **Engineering Fix:** Tracked `loadedDocIdRef.current` in `EditorView.tsx` so `editor.commands.setContent()` only fires when switching to a *different* document ID or explicitly importing a file into the draft.

### Example 2: Enforcing SQL-Level Access Control vs. UI Filtering
- **Initial AI Pattern:** Returning all documents from `GET /api/documents` and filtering "Owned by Me" vs. "Shared with Me" in React state.
- **Why It Was Rejected / Changed:** Client-side filtering leaks private documents over the network and allows any user who guesses a document ID to read or mutate it.
- **Engineering Fix:** Enforced SQL `WHERE (d.owner_id = ? OR ds.user_id = ?)` filtering on list queries and centralized `getDocumentWithAccessCheck(docId, userId)` on all read/write/delete/share endpoints, returning `403 Forbidden` when a `viewer` attempts `PATCH` or a non-owner attempts `DELETE`.

### Example 3: Choosing Native `node:sqlite` Over `better-sqlite3` on Windows Node 24
- **Initial AI Pattern:** Installing `better-sqlite3`, which triggers `node-gyp` native C++ compilation when no prebuilt binary exists for Node v24 on Windows.
- **Why It Was Changed:** Relying on native C++ compilation makes local reviewer setup fragile across different OS/Node versions. Switching to Node's built-in `node:sqlite` (`DatabaseSync`) eliminated native build dependencies while preserving synchronous SQLite performance and WAL persistence.

---

## 4. How We Verified Correctness, UX Quality, and Reliability
1. **Automated Integration Test Suite (`Backend/tests/api.test.ts`):**
   - Verified document creation, rename, rich-text HTML persistence, and `<script>` XSS tag stripping.
   - Verified RBAC enforcement: `viewer` receives `403 READ_ONLY_ACCESS` on `PATCH`, `editor` succeeds on `PATCH` (`200 OK`) but receives `403` on `DELETE`, and unshared users receive `403` on `GET`.
   - Verified `.md` and `.txt` file upload conversion to HTML and `400 UNSUPPORTED_FILE_TYPE` rejection on invalid extensions.
2. **Multi-Persona End-to-End UX Testing:**
   - Verified switching between *Alice Rivera*, *Liam Chen*, and *Maya Patel* in the live UI, confirming that owned vs. shared badges, read-only editor locks, and browser refreshes behave deterministically.
