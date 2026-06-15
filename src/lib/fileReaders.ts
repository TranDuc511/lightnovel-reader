import DOMPurify from 'dompurify';
import { marked } from 'marked';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

export type FileKind = 'markdown' | 'text' | 'pdf' | 'unsupported';

export type ParsedNovel = {
  title: string;
  kind: Exclude<FileKind, 'unsupported'>;
  html: string;
  rawText: string;
};

const decoder = new TextDecoder('utf-8');

export function detectFileKind(fileName: string): FileKind {
  const normalized = fileName.toLowerCase().trim();
  if (normalized.endsWith('.md') || normalized.endsWith('.markdown')) return 'markdown';
  if (normalized.endsWith('.txt')) return 'text';
  if (normalized.endsWith('.pdf')) return 'pdf';
  return 'unsupported';
}

export function renderMarkdown(markdown: string): string {
  const rendered = marked.parse(markdown, {
    async: false,
    breaks: true,
    gfm: true
  }) as string;

  return DOMPurify.sanitize(rendered, {
    USE_PROFILES: { html: true }
  });
}

export function txtToHtml(text: string): string {
  const paragraphs = text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return paragraphs
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

export async function parseNovelFile(file: File): Promise<ParsedNovel> {
  const kind = detectFileKind(file.name);
  const title = file.name.replace(/\.[^.]+$/, '');

  if (kind === 'unsupported') {
    throw new Error('Định dạng chưa hỗ trợ. Hãy chọn file .md, .txt hoặc .pdf.');
  }

  if (kind === 'pdf') {
    const rawText = await extractPdfText(await file.arrayBuffer());
    return { title, kind, rawText, html: txtToHtml(rawText) };
  }

  const rawText = decoder.decode(await file.arrayBuffer());
  const html = kind === 'markdown' ? renderMarkdown(rawText) : txtToHtml(rawText);
  return { title, kind, rawText, html };
}

async function extractPdfText(data: ArrayBuffer): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const task = pdfjsLib.getDocument({ data });
  const pdf = await task.promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) pages.push(text);
  }

  return pages.join('\n\n');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
