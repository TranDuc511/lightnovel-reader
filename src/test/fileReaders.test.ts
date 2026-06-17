import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { detectFileKind, parseNovelFile, renderMarkdown, txtToHtml } from '../lib/fileReaders';

describe('file reader helpers', () => {
  it('detects supported file kinds case-insensitively', () => {
    expect(detectFileKind('Chapter01.MD')).toBe('markdown');
    expect(detectFileKind('volume 1.Txt')).toBe('text');
    expect(detectFileKind('Novel.PDF')).toBe('pdf');
    expect(detectFileKind('Illustrated Novel.EPUB')).toBe('epub');
    expect(detectFileKind('archive.cbz')).toBe('unsupported');
  });

  it('renders markdown and strips unsafe scripts', () => {
    const html = renderMarkdown('# Chapter 1\n\n**Hello**<script>alert(1)</script>');

    expect(html).toContain('<h1>Chapter 1</h1>');
    expect(html).toContain('<strong>Hello</strong>');
    expect(html).not.toContain('<script>');
  });

  it('converts txt paragraphs into readable html', () => {
    const html = txtToHtml('Line one\nLine two\n\nNew paragraph');

    expect(html).toContain('<p>Line one<br>Line two</p>');
    expect(html).toContain('<p>New paragraph</p>');
  });

  it('parses EPUB spine content and preserves illustration images as durable data URLs', async () => {
    const epubFile = await createIllustratedEpubFile();
    const parsed = await parseNovelFile(epubFile);

    expect(parsed.kind).toBe('epub');
    expect(parsed.title).toBe('illustrated-novel');
    expect(parsed.rawText).toContain('A chapter with an illustration.');
    expect(parsed.html).toContain('<h1>Chapter One</h1>');
    expect(parsed.html).toContain('src="data:image/png;base64,iVBORw=="');
    expect(parsed.html).toContain('alt="Hero illustration"');
  });
});

async function createIllustratedEpubFile(): Promise<File> {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip');
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0"?>
    <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
      <rootfiles>
        <rootfile full-path="OPS/package.opf" media-type="application/oebps-package+xml" />
      </rootfiles>
    </container>`
  );
  zip.file(
    'OPS/package.opf',
    `<?xml version="1.0"?>
    <package xmlns="http://www.idpf.org/2007/opf" version="3.0">
      <manifest>
        <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml" />
        <item id="hero" href="images/hero.png" media-type="image/png" />
      </manifest>
      <spine>
        <itemref idref="chapter1" />
      </spine>
    </package>`
  );
  zip.file(
    'OPS/chapter1.xhtml',
    `<?xml version="1.0"?>
    <html xmlns="http://www.w3.org/1999/xhtml">
      <body>
        <h1>Chapter One</h1>
        <p>A chapter with an illustration.</p>
        <img src="images/hero.png" alt="Hero illustration" />
      </body>
    </html>`
  );
  zip.file('OPS/images/hero.png', new Uint8Array([137, 80, 78, 71]));

  const data = await zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
  return new File([data], 'illustrated-novel.epub', { type: 'application/epub+zip' });
}
