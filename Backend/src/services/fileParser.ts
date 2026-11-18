import path from 'node:path';
import mammoth from 'mammoth';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { AppError } from '../middleware/errorHandler.js';

export const ALLOWED_EXTENSIONS = ['.txt', '.md', '.docx'] as const;
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'h1',
    'h2',
    'h3',
    'p',
    'strong',
    'b',
    'em',
    'i',
    'u',
    'ul',
    'ol',
    'li',
    'br',
    'blockquote',
    'code',
    'pre',
    'hr'
  ],
  allowedAttributes: {},
  transformTags: {
    b: 'strong',
    i: 'em',
    h4: 'h3',
    h5: 'h3',
    h6: 'h3'
  }
};

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, SANITIZE_OPTIONS).trim();
}

export interface ParsedFileResult {
  inferredTitle: string;
  htmlContent: string;
  originalFilename: string;
  extension: string;
}

export async function parseUploadedFile(
  originalName: string,
  buffer: Buffer
): Promise<ParsedFileResult> {
  const ext = path.extname(originalName).toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
    throw new AppError(
      400,
      'UNSUPPORTED_FILE_TYPE',
      `Unsupported file format '${ext || 'unknown'}'. Supported formats are .txt, .md, and .docx.`
    );
  }

  if (!buffer || buffer.length === 0) {
    throw new AppError(400, 'EMPTY_FILE', 'The uploaded file is empty.');
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new AppError(400, 'FILE_TOO_LARGE', 'File exceeds the 5 MB limit.');
  }

  const baseName = path.basename(originalName, path.extname(originalName)).trim();
  const inferredTitle = baseName ? baseName.replace(/[-_]+/g, ' ') : 'Imported Document';

  let rawHtml = '';

  if (ext === '.txt') {
    const text = buffer.toString('utf-8').replace(/\r\n/g, '\n').trim();
    const paragraphs = text
      .split(/\n{2,}/)
      .map((para) => para.trim())
      .filter(Boolean);

    rawHtml =
      paragraphs.length > 0
        ? paragraphs
            .map(
              (p) =>
                `<p>${escapeHtml(p).replace(/\n/g, '<br />')}</p>`
            )
            .join('\n')
        : '<p></p>';
  } else if (ext === '.md') {
    const mdText = buffer.toString('utf-8');
    rawHtml = await marked.parse(mdText, { async: true });
  } else if (ext === '.docx') {
    try {
      const result = await mammoth.convertToHtml({ buffer });
      rawHtml = result.value || '<p></p>';
    } catch {
      throw new AppError(
        400,
        'CORRUPT_DOCX_FILE',
        'Could not parse the uploaded .docx file. Please ensure it is a valid Word document.'
      );
    }
  }

  const htmlContent = sanitizeRichText(rawHtml) || '<p></p>';

  return {
    inferredTitle,
    htmlContent,
    originalFilename: originalName,
    extension: ext
  };
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
