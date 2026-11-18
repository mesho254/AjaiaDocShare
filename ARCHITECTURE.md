# Architecture Note — Prioritization & Technical Tradeoffs

## 1. Product & Engineering Prioritization

Given the 4–6 hour constraint, our primary goal was to deliver a **complete, high-trust vertical slice** across editing, file import, sharing permissions, and persistence rather than shallow approximations of every Google Docs menu item.

### Key Decisions & What We Prioritized

1. **Schema-Driven Rich-Text Editing (`TipTap` / `ProseMirror`) over Raw `contenteditable`**
   - *Why:* Relying on browser-native `document.execCommand` produces inconsistent DOM structures across browsers and breaks nested lists on reload. TipTap enforces a strict ProseMirror schema for Bold, Italic, Underline, Headings (`H1`–`H3`), and Bullet/Ordered Lists, serializing to clean semantic HTML.
2. **Product-Relevant File Upload Conversion (`.docx`, `.md`, `.txt` -> Editable HTML)**
   - *Why:* In a collaborative document editor, uploading a file is most useful when it turns static notes into an editable living document. Using `mammoth` (for `.docx`), `marked` (for `.md`), and a paragraph parser (for `.txt`), users can either create a new document from a file or import a file's contents into an active draft.
3. **Server-Enforced Role-Based Sharing (`Owner`, `Editor`, `Viewer`) + 1-Click Persona Switcher**
   - *Why:* Reviewers evaluating sharing flows shouldn't have to register multiple email accounts or wrestle with SMTP verification links. We paired a 1-click top-bar persona switcher (*Alice*, *Liam*, *Maya*) with real SQL join filtering and server-side RBAC enforcement (`403 Forbidden` when a `viewer` attempts to save or a non-owner attempts to delete or alter sharing).
4. **Zero-Config Relational Persistence (`node:sqlite` in WAL Mode)**
   - *Why:* Using Node's built-in `node:sqlite` (`DatabaseSync`) provides a true SQL relational database (`users`, `documents`, `document_shares`) with foreign-key integrity and zero native C++ `node-gyp` build failures or external database setup requirements.

---

## 2. Intentional Scope Cuts & Tradeoffs

| Area | What We Built | What We Intentionally Deprioritized | Rationale |
| :--- | :--- | :--- | :--- |
| **Collaboration Sync** | Debounced (`800ms`) REST auto-save + manual `Ctrl+S` save with live status badge | Stateful WebSocket CRDT sync (`Yjs` / `y-websocket`) | CRDT WebSocket servers introduce significant state-sync edge cases in a 4–6 hour build; deterministic REST persistence guarantees zero data corruption. |
| **Authentication** | Header-backed user context (`x-user-id`) with 3 pre-seeded team personas | Full OAuth / Magic-Link email flows (Auth0 / Clerk) | Keeps local setup and live evaluation frictionless while exercising real multi-user database authorization logic. |
| **Canvas Layout** | Continuous modern page canvas (Google Docs "Pageless" / Notion style) + `@media print` PDF support | Simulated multi-page `8.5" x 11"` DOM pagination breaks | DOM page-break splitting is visually brittle and detracts from core rich-text editing and sharing UX. |

---

## 3. Request & Data Lifecycle

1. **Authentication Context:** Every request from the React client includes `x-user-id` (selected via the Persona Switcher). `authMiddleware` resolves the user against the `users` table.
2. **Access Verification:** `getDocumentWithAccessCheck(docId, userId)` executes a `LEFT JOIN` across `documents` and `document_shares` to compute the caller's effective role (`owner`, `editor`, `viewer`, or `null` -> `403 Forbidden`).
3. **HTML Sanitization:** Both edited HTML (`PATCH /api/documents/:id`) and uploaded file conversions (`POST /api/documents/upload`) pass through `sanitize-html` with an explicit tag whitelist (`h1`–`h3`, `p`, `strong`, `em`, `u`, `ul`, `ol`, `li`, `blockquote`, `code`, `pre`, `br`) to prevent stored XSS.
