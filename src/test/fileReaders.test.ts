import { describe, expect, it } from 'vitest';
import { detectFileKind, renderMarkdown, txtToHtml } from '../lib/fileReaders';

describe('file reader helpers', () => {
  it('detects supported file kinds case-insensitively', () => {
    expect(detectFileKind('Chapter01.MD')).toBe('markdown');
    expect(detectFileKind('volume 1.Txt')).toBe('text');
    expect(detectFileKind('Novel.PDF')).toBe('pdf');
    expect(detectFileKind('archive.epub')).toBe('unsupported');
  });

  it('renders markdown and strips unsafe scripts', () => {
    const html = renderMarkdown('# Chương 1\n\n**Xin chào**<script>alert(1)</script>');

    expect(html).toContain('<h1>Chương 1</h1>');
    expect(html).toContain('<strong>Xin chào</strong>');
    expect(html).not.toContain('<script>');
  });

  it('converts txt paragraphs into readable html', () => {
    const html = txtToHtml('Dòng một\nDòng hai\n\nĐoạn mới');

    expect(html).toContain('<p>Dòng một<br>Dòng hai</p>');
    expect(html).toContain('<p>Đoạn mới</p>');
  });
});
