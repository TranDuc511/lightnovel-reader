import DOMPurify from 'dompurify';
import JSZip from 'jszip';
import { marked } from 'marked';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

export type FileKind = 'markdown' | 'text' | 'pdf' | 'epub' | 'unsupported';

export type ParsedNovel = {
  title: string;
  kind: Exclude<FileKind, 'unsupported'>;
  html: string;
  rawText: string;
};

type EpubManifestItem = {
  href: string;
  mediaType: string;
};

const decoder = new TextDecoder('utf-8');

export function detectFileKind(fileName: string): FileKind {
  const normalized = fileName.toLowerCase().trim();
  if (normalized.endsWith('.md') || normalized.endsWith('.markdown')) return 'markdown';
  if (normalized.endsWith('.txt')) return 'text';
  if (normalized.endsWith('.pdf')) return 'pdf';
  if (normalized.endsWith('.epub')) return 'epub';
  return 'unsupported';
}

export function renderMarkdown(markdown: string): string {
  const rendered = marked.parse(markdown, {
    async: false,
    breaks: true,
    gfm: true
  }) as string;

  return sanitizeHtml(rendered);
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
    throw new Error('Unsupported format. Please choose a .md, .txt, .pdf, or .epub file.');
  }

  if (kind === 'pdf') {
    const rawText = await extractPdfText(await file.arrayBuffer());
    return { title, kind, rawText, html: txtToHtml(rawText) };
  }

  if (kind === 'epub') {
    const parsed = await extractEpubContent(await file.arrayBuffer());
    return { title, kind, ...parsed };
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

async function extractEpubContent(data: ArrayBuffer): Promise<Pick<ParsedNovel, 'html' | 'rawText'>> {
  const zip = await JSZip.loadAsync(data);
  const opfPath = await findPackageDocumentPath(zip);
  const opfXml = await readTextFile(zip, opfPath);
  const opfDocument = parseXml(opfXml, 'EPUB package document');
  const opfDirectory = directoryName(opfPath);

  const manifest = readManifest(opfDocument);
  const spineHrefs = readSpineHrefs(opfDocument, manifest);
  const imageUrls = new Map<string, string>();
  const chapterHtml: string[] = [];
  const chapterText: string[] = [];

  for (const href of spineHrefs) {
    const chapterPath = normalizeZipPath(joinZipPath(opfDirectory, href));
    const chapterXml = await readTextFile(zip, chapterPath);
    const chapterDocument = parseXml(chapterXml, chapterPath);
    const body = chapterDocument.querySelector('body');
    if (!body) continue;

    await inlineEpubImages(body, zip, directoryName(chapterPath), imageUrls);
    removeNamespaceAttributes(body);
    chapterText.push((body.textContent ?? '').replace(/\s+/g, ' ').trim());
    chapterHtml.push(sanitizeHtml(stripXmlnsAttributes(body.innerHTML)));
  }

  if (chapterHtml.length === 0) {
    throw new Error('This EPUB does not contain readable spine content.');
  }

  return {
    html: chapterHtml.join('\n<hr>\n'),
    rawText: chapterText.filter(Boolean).join('\n\n')
  };
}

async function findPackageDocumentPath(zip: JSZip): Promise<string> {
  const containerXml = await readTextFile(zip, 'META-INF/container.xml');
  const container = parseXml(containerXml, 'EPUB container');
  const rootFile = container.querySelector('rootfile');
  const fullPath = rootFile?.getAttribute('full-path');

  if (!fullPath) {
    throw new Error('Invalid EPUB: missing package document path.');
  }

  return normalizeZipPath(fullPath);
}

function readManifest(opfDocument: Document): Map<string, EpubManifestItem> {
  const manifest = new Map<string, EpubManifestItem>();

  opfDocument.querySelectorAll('manifest > item').forEach((item) => {
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    const mediaType = item.getAttribute('media-type') ?? '';
    if (id && href) manifest.set(id, { href, mediaType });
  });

  return manifest;
}

function readSpineHrefs(opfDocument: Document, manifest: Map<string, EpubManifestItem>): string[] {
  return Array.from(opfDocument.querySelectorAll('spine > itemref'))
    .map((itemref) => itemref.getAttribute('idref'))
    .filter((idref): idref is string => Boolean(idref))
    .map((idref) => manifest.get(idref))
    .filter((item): item is EpubManifestItem => Boolean(item))
    .filter((item) => item.mediaType.includes('html') || item.href.match(/\.x?html?$/i))
    .map((item) => item.href);
}

async function inlineEpubImages(
  root: Element,
  zip: JSZip,
  chapterDirectory: string,
  imageUrls: Map<string, string>
): Promise<void> {
  const images = Array.from(root.querySelectorAll('img, image'));

  for (const image of images) {
    const rawSrc = image.getAttribute('src') ?? image.getAttribute('href') ?? image.getAttribute('xlink:href');
    if (!rawSrc || rawSrc.startsWith('data:') || rawSrc.startsWith('blob:') || rawSrc.startsWith('http')) continue;

    const [pathOnly] = rawSrc.split('#');
    const imagePath = normalizeZipPath(joinZipPath(chapterDirectory, decodeURI(pathOnly)));
    const imageFile = zip.file(imagePath);
    if (!imageFile) continue;

    let objectUrl = imageUrls.get(imagePath);
    if (!objectUrl) {
      const blob = await imageFile.async('blob');
      objectUrl = URL.createObjectURL(blob);
      imageUrls.set(imagePath, objectUrl);
    }

    image.setAttribute('src', objectUrl);
    image.removeAttribute('href');
    image.removeAttribute('xlink:href');
  }
}

async function readTextFile(zip: JSZip, path: string): Promise<string> {
  const file = zip.file(normalizeZipPath(path));
  if (!file) throw new Error(`Invalid EPUB: missing ${path}.`);
  return file.async('text');
}

function parseXml(xml: string, label: string): Document {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  const parserError = document.querySelector('parsererror');
  if (parserError) throw new Error(`Unable to parse ${label}.`);
  return document;
}

function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_TAGS: ['image'],
    ADD_ATTR: ['src', 'alt', 'title', 'width', 'height', 'viewBox'],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|blob|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
  });
}

function stripXmlnsAttributes(html: string): string {
  return html.replace(/\sxmlns(:\w+)?="[^"]*"/g, '');
}

function removeNamespaceAttributes(root: Element): void {
  root.querySelectorAll('*').forEach((element) => {
    Array.from(element.attributes)
      .filter((attribute) => attribute.name === 'xmlns' || attribute.name.startsWith('xmlns:'))
      .forEach((attribute) => element.removeAttribute(attribute.name));
  });
}

function joinZipPath(baseDirectory: string, href: string): string {
  if (!baseDirectory) return href;
  return `${baseDirectory}/${href}`;
}

function directoryName(path: string): string {
  const normalized = normalizeZipPath(path);
  const lastSlash = normalized.lastIndexOf('/');
  return lastSlash === -1 ? '' : normalized.slice(0, lastSlash);
}

function normalizeZipPath(path: string): string {
  const parts: string[] = [];

  path
    .replace(/\\/g, '/')
    .split('/')
    .filter((part) => part && part !== '.')
    .forEach((part) => {
      if (part === '..') parts.pop();
      else parts.push(part);
    });

  return parts.join('/');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
