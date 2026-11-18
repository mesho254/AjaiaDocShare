# Submission Summary — Ajaia Docs

## 1. Included Deliverables

- **`./Backend`** — Node.js + Express + TypeScript + SQLite (`node:sqlite`) API server with file parsing (`mammoth`, `marked`), HTML sanitization (`sanitize-html`), Zod validation, and Vitest integration tests.
- **`./Frontend`** — React 18 + Vite + TypeScript + Tailwind CSS + TipTap rich-text workspace.
- **`./sample-files`** — Sample `.md` and `.txt` files ready for testing the File Upload flow.
- **[README.md](./README.md)** — Local setup, run instructions, seeded user credentials, supported file formats, and test commands.
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — Architecture note explaining prioritization, system design, and intentional tradeoffs.
- **[AI_WORKFLOW.md](./AI_WORKFLOW.md)** — Practical AI workflow note detailing tools used, speedups, rejected/modified outputs, and verification.
- **[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)** — Full implementation plan & assignment walkthrough guide.
- **`walkthrough_video.txt`** — Link to the 3–5 minute product & engineering walkthrough video.

---

## 2. Live Deployment & Test Accounts

- **Live Product URL:** *(Paste your deployed Render / Railway / Vercel URL here before final submission)*
- **Walkthrough Video URL:** *(Paste your unlisted Loom or YouTube URL in `walkthrough_video.txt` and here)*

### Seeded Test Accounts (Available via 1-Click Switcher in the Top Bar)
No login password is required—use the **Switch Persona** pill in the top navigation bar to test ownership and sharing flows immediately:
1. **Alice Rivera** (`alice@ajaia.io`) — Product Lead *(Default active user)*
2. **Liam Chen** (`liam@ajaia.io`) — Staff Engineer
3. **Maya Patel** (`maya@ajaia.io`) — Product Designer

---

## 3. Feature Status & Roadmap

### What is Working End-to-End
- **Document Creation & Rich-Text Authoring:** Create, inline rename, delete, and format documents with Bold, Italic, Underline, Headings (`H1`–`H3`), Bulleted Lists, Numbered Lists, and Undo/Redo.
- **Auto-Save & Persistence:** `800ms` debounced auto-save + manual `Ctrl/Cmd+S` save button backed by SQLite WAL persistence across refreshes and restarts.
- **File Upload (`.txt`, `.md`, `.docx`):** Upload a file from the Dashboard to create a new editable document, or click **Import File** inside the editor toolbar to import content into an existing draft.
- **Sharing & Access Control (`Owner`, `Editor`, `Viewer`):** Share documents by email or quick-select pills, switch roles between `Can Edit` and `View Only`, revoke access, filter by `Owned by Me` vs. `Shared with Me`, and enforce read-only locks in both UI and API.
- **Stretch Features Included (All 5 Implemented):**
  1. **Real-Time Collaboration Indicators:** Live collaborator presence avatars in the header, live text carets (`coordsAtPos`), and live Figma-style mouse pointers with user avatars across windows.
  2. **Commenting & Suggestion Mode:** Slide-over drawer supporting anchored comments and text replacement suggestions across `Owner`, `Editor`, and `Viewer` roles, with 1-click **Accept Suggestion**.
  3. **Document Version History:** Timeline modal of saved checkpoints (`document_versions` table) with full preview, named snapshot creation, and 1-click **Restore This Version**.
  4. **Export to PDF or Markdown:** 1-click export to `.md` or Print/PDF from the editor toolbar.
  5. **Role-Based Sharing Permissions:** `Owner`, `Editor` (`Can Edit`), and `Viewer` (`View Only`) roles enforced on both client and server.
- **Automated Tests:** Passing `Vitest + Supertest` integration suite (7/7 tests) covering CRUD, XSS sanitization, file upload conversion, RBAC `403` enforcement, Swagger UI, Version History restore, and Comments/Suggestions.

### What is Intentionally Partial / Deprioritized
- **Real-Time Concurrent Cursor Sync:** Uses deterministic REST auto-save rather than stateful WebSocket CRDTs (`Yjs`).
- **Inline Anchored Comments & Diff History:** Focused engineering budget on core editor fidelity, file import, and role-based sharing.

### What I Would Build Next with Another 2–4 Hours
1. **Real-Time Co-Editing (`Yjs` + `y-websocket`):** Add live collaborator presence avatars, live cursors, and conflict-free concurrent editing.
2. **Document Version History (`document_versions` table):** Capture periodic snapshots so owners can inspect diffs and restore earlier drafts.
3. **Inline Comment Threads:** Add a custom TipTap mark extension allowing `Viewer` and `Editor` collaborators to highlight text spans and resolve comment threads.
