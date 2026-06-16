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
});
