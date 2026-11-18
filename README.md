# Ajaia Docs — Lightweight Collaborative Document Workspace

**Ajaia Docs** is a full-stack collaborative document editor built for the **AI-Native Full Stack Developer Assignment**. It focuses on fast rich-text authoring, converting uploaded files into living documents, and clear multi-user sharing with role-based access control.

---

## Core Capabilities

1. **Document Creation & Rich-Text Editing (TipTap / ProseMirror)**
   - Create blank documents, rename inline, and delete owned documents.
   - Rich-text formatting toolbar & keyboard shortcuts: **Bold** (`Ctrl/Cmd+B`), **Italic** (`Ctrl/Cmd+I`), **Underline** (`Ctrl/Cmd+U`), **Headings (`H1`, `H2`, `H3`)**, **Normal Paragraph**, **Bulleted Lists**, **Numbered Lists**, and **Undo/Redo**.
   - **Auto-Save + Manual Save:** Debounced auto-save (`800ms`) paired with an explicit `Save (Ctrl/Cmd+S)` button and live save status indicator (`Saved`, `Saving...`, `Unsaved changes`).
   - **Stretch Export:** 1-click export to **Markdown (`.md`)** or **Print / PDF**.

2. **File Upload Workflow (`.txt`, `.md`, `.docx`)**
   - **Upload as New Document:** Upload a file from the dashboard to automatically parse its structure and open it as a new editable document.
   - **Import into Active Draft:** Import file content directly into an open document from the editor toolbar.
   - **Supported File Types & Limits:** Explicitly supports `.txt` (Plain Text), `.md` (Markdown via `marked`), and `.docx` (Word via `mammoth`) up to **5 MB**. Unsupported file extensions or oversized files are rejected with clear validation messages on both client and server.

3. **Sharing & Role-Based Access Control (`Owner`, `Editor`, `Viewer`)**
   - Every document has an immutable **Owner** who can grant or revoke access for teammates.
   - Collaborators can be assigned **Can Edit (`editor`)** or **View Only (`viewer`)** permissions.
   - Dashboard filter tabs clearly distinguish **All Accessible**, **Owned by Me**, and **Shared with Me** with role badges.
   - **Read-Only Enforcement:** Opening a document as a `viewer` locks the editor toolbar, displays a Read-Only banner, and enforces `403 Forbidden` on backend write/delete endpoints.

4. **Zero-Config SQLite Persistence & Pre-Seeded Personas**
   - Built on Node's native `node:sqlite` (`./Backend/data/ajaia.db` in WAL mode) so documents and sharing state persist across browser refreshes and server restarts with zero external database setup.

---

## Seeded Test Accounts (1-Click Persona Switcher)

To make multi-user sharing evaluation effortless, the top navigation bar includes a **1-Click Persona Switcher** pre-seeded with three team accounts:

| Persona Name | Email | Role Title | Pre-Seeded Access |
| :--- | :--- | :--- | :--- |
| **Alice Rivera** | `alice@ajaia.io` | Product Lead | Owns *Q4 Product Roadmap*; `Editor` on Liam's RFC; `Viewer` on Maya's Design Doc |
| **Liam Chen** | `liam@ajaia.io` | Staff Engineer | Owns *Engineering Architecture RFC*; `Editor` on Alice's Roadmap |
| **Maya Patel** | `maya@ajaia.io` | Product Designer | Owns *Design System Guidelines*; `Viewer` on Alice's Roadmap |

---

## Local Setup & Run Instructions

### Prerequisites
- **Node.js v22.5+ or v24+** (uses native `node:sqlite` for zero-config SQLite persistence)
- **npm**

### 1. Start the Backend API (`http://localhost:4000`)

```bash
cd Backend
npm install
npm run dev
```

- **Interactive Swagger UI API Docs:** Open **`http://localhost:4000/api/docs`** (or click the **Swagger API** button in the top navigation bar of the frontend).
- **Raw OpenAPI 3.0 Spec:** `http://localhost:4000/api/openapi.json`

### 2. Start the Frontend Web App (`http://localhost:5173`)

Open a second terminal:

```bash
cd Frontend
npm install
npm run dev
```

Then open **`http://localhost:5173`** in your browser.
*(Sample `.md` and `.txt` files for testing the file upload flow are included in `./sample-files/`.)*

### 3. Run Automated Integration Tests

```bash
cd Backend
npm test
```

The `Vitest + Supertest` suite runs against an isolated in-memory SQLite instance and verifies:
1. Seeded user resolution and session context.
2. Document creation, renaming, rich-text formatting persistence, and XSS script stripping.
3. Role-based sharing boundaries (`Owner` vs. `Editor` vs. `Viewer` `403` enforcement vs. unshared `403` block).
4. `.md` and `.txt` file upload conversion to HTML and rejection of unsupported file extensions.

---

## Production Build & Single-Service Deployment

The backend automatically serves the compiled frontend bundle (`./Frontend/dist`) when present, allowing the entire full-stack app to deploy as a single web service (e.g., on Render, Railway, or Fly.io):

```bash
cd Frontend && npm install && npm run build
cd ../Backend && npm install && npm start
```
