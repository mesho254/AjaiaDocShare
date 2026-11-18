# Ajaia Docs — AI-Native Full Stack Developer Assignment Submission

## 1. Quick Links for Reviewers

- **Google Drive Folder (All Deliverables & Source Code):** https://drive.google.com/drive/folders/1Exl7LIk6pgaKV0EPc9CRp-fOCOKfW2_f?usp=sharing
- **Live Deployed Product URL:** https://ajaia-docs-uk44.onrender.com/
- **Interactive Backend Swagger UI:** https://ajaia-docs-uk44.onrender.com/api/docs
- **Walkthrough Video (Loom):** https://www.loom.com/share/c8e1917d5f3e4dd78898be3bd59083b2

---

## 2. Seeded Test Accounts (1-Click Persona Switcher)

No registration or password is required to test multi-user sharing and live collaboration. Use the **Switch Persona** control in the top navigation bar (or open two browser windows side by side) to switch immediately between our three pre-seeded team members:

| Persona Name | Email | Role Title | Pre-Seeded Access |
| :--- | :--- | :--- | :--- |
| **Alice Rivera** | `alice@ajaia.io` | Product Lead | Owns *Q4 Product Roadmap*; `Editor` on Liam's RFC; `Viewer` on Maya's Design Doc |
| **Liam Chen** | `liam@ajaia.io` | Staff Engineer | Owns *Engineering Architecture RFC*; `Editor` on Alice's Roadmap |
| **Maya Patel** | `maya@ajaia.io` | Product Designer | Owns *Design System Guidelines*; `Viewer` on Alice's Roadmap |

---

## 3. What Is Included in the Google Drive Folder

1. **`source-code/` & `Ajaia-Docs-Source-Code.zip`** — Complete full-stack TypeScript source code (`./Frontend` React + Vite + TipTap + Tailwind CSS, and `./Backend` Node.js + Express + SQLite + Vitest/Supertest).
2. **`README.md`** — Local setup, run instructions, seeded user credentials, supported file formats, and automated test instructions.
3. **`ARCHITECTURE.md`** — Architecture note detailing product prioritization, system design, and intentional scope tradeoffs.
4. **`AI_WORKFLOW.md`** — Practical AI-Native workflow note explaining tools used, where AI accelerated execution, what AI outputs were modified/rejected, and verification steps.
5. **`SUBMISSION.md`** — This submission summary and feature checklist.
6. **`walkthrough_video.txt`** — Direct link to the Loom walkthrough video.
7. **`sample-files/`** — Ready-to-upload `.md` and `.txt` sample files to test the File Upload conversion pipeline.

---

## 4. Feature Status (Core + All 5 Optional Stretch Enhancements)

### Working End-to-End
- **1. Document Creation & Rich-Text Editing:**
  - Create blank documents, rename inline, delete owned documents, and search/filter on the dashboard.
  - Schema-driven **TipTap (ProseMirror)** editor supporting **Bold** (`Ctrl/Cmd+B`), **Italic** (`Ctrl/Cmd+I`), **Underline** (`Ctrl/Cmd+U`), **Headings (`H1`–`H3`)**, **Normal Paragraph**, **Bulleted Lists**, **Numbered Lists**, and **Undo/Redo**.
  - `250ms` debounced auto-save paired with an explicit **Save (`Ctrl/Cmd+S`)** button and live status indicator (`Saved`, `Saving...`, `Syncing...`).
- **2. File Upload (`.txt`, `.md`, `.docx` up to 5 MB):**
  - **Upload as New Document** from the dashboard or **Import File** into an active draft from the editor toolbar.
  - Converts `.docx` (via `mammoth`), `.md` (via `marked`), and `.txt` into sanitized semantic HTML (`sanitize-html`). Rejects unsupported extensions or files `>5 MB` with clear validation messages.
- **3. Sharing & Access Control (`Owner`, `Editor`, `Viewer`):**
  - Immutable document `Owner` can grant, update, or revoke `Can Edit (editor)` and `View Only (viewer)` access by email or 1-click teammate pills.
  - Clear UI distinction via dashboard filter tabs (**All Accessible**, **Owned by Me**, **Shared with Me**) and role badges.
  - Opening a document as a `viewer` locks the editor into **Read-Only Mode** and enforces `403 Forbidden` on backend write/delete endpoints.
- **4. Persistence:**
  - Relational **SQLite (`node:sqlite` in WAL mode)** persisting users, documents, shares, version snapshots, and comments across refreshes and server restarts.
- **5. Engineering Quality & All 5 Stretch Features:**
  - **Real-Time Collaboration Indicators:** Server-Sent Events (SSE) hub broadcasting live edits, active collaborator avatars, live colored text carets (`coordsAtPos`), and live Figma-style mouse pointers with user avatars across browser windows.
  - **Commenting & Suggestion Mode:** Slide-over drawer supporting anchored comments and text replacement suggestions across `Owner`, `Editor`, and `Viewer` roles, with 1-click **Accept Suggestion**.
  - **Document Version History:** Timeline modal of saved checkpoints (`document_versions` table) with full preview, named snapshot creation, and 1-click **Restore This Version**.
  - **Export to PDF or Markdown:** 1-click `.md` download and print-ready PDF view from the toolbar.
  - **Automated Tests & API Docs:** `7/7` passing `Vitest + Supertest` integration tests + interactive **Swagger UI** at `/api/docs`.

### Intentionally Deprioritized & What I Would Build Next (With Another 2–4 Hours)
- **What is partial/deprioritized:** Sub-document character-level CRDT merge conflict resolution (currently uses fast SSE broadcast + last-write-wins HTML sync) and enterprise OAuth/SSO login.
- **What I would build next with another 2–4 hours:**
  1. **CRDT Binary Delta Sync (`Yjs`):** Upgrade the SSE transport to stream fine-grained ProseMirror/Yjs steps for character-level conflict resolution under simultaneous same-word edits.
  2. **Visual Diff Viewer in Version History:** Highlight added/removed spans in green/red when previewing historical snapshots before restoring.
  3. **Folder Organization & Public Read-Only Share Links:** Allow grouping documents into team folders and generating tokenized read-only links for external guests.

---

## 5. Local Setup & Run Instructions

### Prerequisites
- **Node.js v22.5+ or v24+** and **npm**

### Option A: Run Backend & Frontend in Development Mode
```bash
# Terminal 1 — Start Backend API (http://localhost:4000 & Swagger UI at http://localhost:4000/api/docs)
cd Backend
npm install
npm run dev

# Terminal 2 — Start Frontend App (http://localhost:5173)
cd Frontend
npm install
npm run dev
```

### Option B: Run Automated Integration Tests
```bash
cd Backend
npm test
```

---

## 6. Architecture Note

### What We Prioritized and Why
1. **Schema-Backed Rich Text (`TipTap` / `ProseMirror`) over Raw `contenteditable`:** Calling browser-native `document.execCommand` yields inconsistent DOM markup and broken nested lists. TipTap enforces a clean schema for Bold, Italic, Underline, Headings (`H1`–`H3`), and Lists that serializes deterministically and survives reloads intact.
2. **Product-Relevant File Import (`.docx`, `.md`, `.txt` -> Editable HTML):** Instead of storing dead binary attachments, uploaded files are parsed in memory (`mammoth` for `.docx`, `marked` for `.md`), sanitized with `sanitize-html`, and turned directly into editable documents.
3. **Server-Enforced RBAC + 1-Click Persona Switcher:** Evaluators can test `Owner`, `Editor`, and `Viewer` permissions in one click without registering throwaway email accounts, while every API endpoint enforces SQL-level authorization (`403 Forbidden` for unauthorized reads/writes).
4. **Live Multi-Window Collaboration via SSE (`realtimeHub.ts`):** Built an SSE room manager that streams live document edits, collaborator presence, ProseMirror text carets, and relative mouse coordinates across browser windows with automatic departure cleanup.

---

## 7. AI-Native Workflow Note

### 1. Which AI Tools Were Used
- **Antigravity (Agentic Coding Assistant):** Used for architectural planning, Express/SQLite schema scaffolding, OpenAPI 3.0 Swagger specification, TipTap toolbar wiring, and authoring `Vitest + Supertest` integration tests.

### 2. Where AI Materially Sped Up Work
- **Full-Stack Scaffolding (~60% faster):** Rapidly generated matching TypeScript interfaces, Zod validation schemas, and REST client methods across `./Backend` and `./Frontend`.
- **Multi-Format File Conversion Pipeline:** Accelerated combining `mammoth` (`.docx`), `marked` (`.md`), and `.txt` normalization with `sanitize-html` tag whitelisting.
- **Integration Test Suite:** Quickly generated multi-persona `Supertest` assertions verifying `200 OK` vs. `403 Forbidden` across ownership and sharing boundaries.

### 3. What AI-Generated Output Was Changed or Rejected
1. **Prevented TipTap Cursor Resets on Auto-Save & Live Sync:**
   - *Rejected AI pattern:* Calling `editor.commands.setContent(doc.content)` inside a reactive `useEffect` on every save response, which resets the user's cursor to the end of the document while typing.
   - *Fix:* Guarded `setContent` with `loadedDocIdRef` and cursor selection restoration (`setTextSelection({ from, to })`) so local typing is never interrupted and remote edits preserve cursor position.
2. **Fixed React `<StrictMode>` SSE Disconnect Race Condition:**
   - *Rejected AI pattern:* Keying SSE connections only by `clientId` in `realtimeHub`, where React 18 StrictMode's initial mount/unmount cycle closed the first socket a few milliseconds after the second socket connected and wiped out the active room registration.
   - *Fix:* Assigned a unique `connectionId` per SSE stream and added an explicit `/leave` endpoint + `2.5s` heartbeat check so collaborator avatars appear and disappear accurately.
3. **Replaced Client-Side Filtering with Server-Side SQL RBAC:**
   - *Rejected AI pattern:* Fetching all documents and filtering `Owned` vs. `Shared` in React state.
   - *Fix:* Enforced SQL `LEFT JOIN document_shares` filtering and centralized `getDocumentWithAccessCheck()` on every endpoint.

### 4. How We Verified Correctness, UX Quality, and Reliability
- **Automated Integration Suite (`Backend/tests/api.test.ts`):** `7/7` passing tests covering seeded users, CRUD + `<script>` XSS stripping, RBAC `403` enforcement (`Owner` vs. `Editor` vs. `Viewer` vs. unshared), `.md`/`.txt` upload conversion, Swagger UI, Version History restore, and Comments/Suggestions.
- **Side-by-Side Multi-Window Testing:** Verified live text sync, live caret/mouse avatar overlays, `← All Docs` departure cleanup, and read-only `Viewer` locks across two concurrent browser windows.
