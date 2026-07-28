import { describe, expect, it } from 'vitest';
import { createTableOfContents } from '../lib/tableOfContents';

describe('table of contents', () => {
  it('uses document headings for Markdown content', () => {
    const result = createTableOfContents('<h1>Volume One</h1><h2>Chapter One</h2><p>Text</p>', 'markdown');

    expect(result.entries).toEqual([
      { id: 'toc-entry-1', label: 'Volume One', level: 1 },
      { id: 'toc-entry-2', label: 'Chapter One', level: 2 }
    ]);
    expect(result.html).toContain('data-toc-id="toc-entry-1"');
    expect(result.html).toContain('data-toc-id="toc-entry-2"');
  });

  it('uses EPUB spine chapter labels even when chapters have no headings', () => {
    const result = createTableOfContents(
      '<section data-epub-chapter="Arrival"><p>First chapter</p></section><section data-epub-chapter="Departure"><p>Second chapter</p></section>',
      'epub'
    );

    expect(result.entries.map((entry) => entry.label)).toEqual(['Arrival', 'Departure']);
    expect(result.html).toContain('data-toc-id="toc-entry-2"');
  });

  it('adds stable reading landmarks when TXT or PDF content has no headings', () => {
    const result = createTableOfContents('<p>One</p><p>Two</p><p>Three</p><p>Four</p>', 'pdf');

    expect(result.entries.map((entry) => entry.label)).toEqual([
      'Start',
      'About one quarter in',
      'About halfway through',
      'Near the end'
    ]);
    expect(result.html.match(/data-toc-id/g)).toHaveLength(4);
  });
});
