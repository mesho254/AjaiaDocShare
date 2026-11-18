import React from 'react';
import { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Undo2,
  Redo2,
  FileUp,
  Download,
  Printer,
  Type
} from 'lucide-react';

interface ToolbarProps {
  editor: Editor | null;
  readOnly: boolean;
  onImportIntoDraft: () => void;
  onExportMarkdown: () => void;
  onPrintPdf: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  editor,
  readOnly,
  onImportIntoDraft,
  onExportMarkdown,
  onPrintPdf
}) => {
  if (!editor) {
    return null;
  }

  const btnClass = (active: boolean) =>
    `inline-flex items-center justify-center rounded-lg p-2 text-xs font-medium transition ${
      readOnly
        ? 'cursor-not-allowed opacity-40 text-slate-400'
        : active
        ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200'
        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
    }`;

  return (
    <div className="no-print sticky top-[61px] z-20 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2 shadow-sm">
      {/* Left Formatting Controls */}
      <div className="flex flex-wrap items-center gap-1">
        {/* Undo / Redo */}
        <button
          type="button"
          disabled={readOnly || !editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
          title="Undo (Ctrl+Z)"
          className={btnClass(false)}
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={readOnly || !editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
          title="Redo (Ctrl+Shift+Z)"
          className={btnClass(false)}
        >
          <Redo2 className="h-4 w-4" />
        </button>

        <div className="mx-1 h-5 w-px bg-slate-200" />

        {/* Text Size / Heading Levels */}
        <button
          type="button"
          disabled={readOnly}
          onClick={() => editor.chain().focus().setParagraph().run()}
          title="Normal Paragraph"
          className={btnClass(editor.isActive('paragraph'))}
        >
          <Type className="h-4 w-4" />
          <span className="ml-1 hidden sm:inline">Normal</span>
        </button>
        <button
          type="button"
          disabled={readOnly}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          title="Heading 1"
          className={btnClass(editor.isActive('heading', { level: 1 }))}
        >
          <Heading1 className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={readOnly}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Heading 2"
          className={btnClass(editor.isActive('heading', { level: 2 }))}
        >
          <Heading2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={readOnly}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Heading 3"
          className={btnClass(editor.isActive('heading', { level: 3 }))}
        >
          <Heading3 className="h-4 w-4" />
        </button>

        <div className="mx-1 h-5 w-px bg-slate-200" />

        {/* Bold / Italic / Underline */}
        <button
          type="button"
          disabled={readOnly}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold (Ctrl+B)"
          className={btnClass(editor.isActive('bold'))}
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={readOnly}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic (Ctrl+I)"
          className={btnClass(editor.isActive('italic'))}
        >
          <Italic className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={readOnly}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline (Ctrl+U)"
          className={btnClass(editor.isActive('underline'))}
        >
          <UnderlineIcon className="h-4 w-4" />
        </button>

        <div className="mx-1 h-5 w-px bg-slate-200" />

        {/* Bullet & Numbered Lists */}
        <button
          type="button"
          disabled={readOnly}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bulleted List"
          className={btnClass(editor.isActive('bulletList'))}
        >
          <List className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={readOnly}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered List"
          className={btnClass(editor.isActive('orderedList'))}
        >
          <ListOrdered className="h-4 w-4" />
        </button>
      </div>

      {/* Right File Import & Export Controls */}
      <div className="flex items-center gap-1.5">
        {!readOnly && (
          <button
            type="button"
            onClick={onImportIntoDraft}
            title="Import content from a .txt, .md, or .docx file into this document"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
          >
            <FileUp className="h-3.5 w-3.5 text-indigo-600" />
            <span>Import File</span>
          </button>
        )}

        <button
          type="button"
          onClick={onExportMarkdown}
          title="Export document as Markdown (.md)"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <Download className="h-3.5 w-3.5 text-slate-600" />
          <span className="hidden sm:inline">Export .md</span>
        </button>

        <button
          type="button"
          onClick={onPrintPdf}
          title="Print or Save as PDF"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <Printer className="h-3.5 w-3.5 text-slate-600" />
          <span className="hidden sm:inline">PDF</span>
        </button>
      </div>
    </div>
  );
};
