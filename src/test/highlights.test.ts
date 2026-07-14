import { beforeEach, describe, expect, it } from 'vitest';
import {
  createHighlightAnchor,
  loadHighlights,
  removeHighlight,
  removeHighlights,
  renderHighlightsOnHtml,
  saveHighlight
} from '../lib/highlights';

describe('highlight helpers', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('creates anchor from selected text with nearby context', () => {
    const anchor = createHighlightAnchor('Alpha beta gamma delta epsilon', 6, 16, 5);

    expect(anchor).toEqual({
      quote: 'beta gamma',
      prefix: 'lpha ',
      suffix: ' delt'
    });
  });

  it('saves, loads, deduplicates, and removes highlights per story', () => {
    const firstAnchor = createHighlightAnchor('Alpha beta gamma delta epsilon', 6, 16, 5);
    const secondAnchor = createHighlightAnchor('Alpha beta gamma delta epsilon', 17, 22, 5);

    const first = saveHighlight(
      'story-a',
      firstAnchor,
      window.localStorage,
      () => new Date('2026-06-29T10:00:00.000Z'),
      () => 'highlight-1'
    );
    const duplicate = saveHighlight(
      'story-a',
      firstAnchor,
      window.localStorage,
      () => new Date('2026-06-29T10:01:00.000Z'),
      () => 'highlight-duplicate'
    );
    const second = saveHighlight(
      'story-a',
      secondAnchor,
      window.localStorage,
      () => new Date('2026-06-29T10:02:00.000Z'),
      () => 'highlight-2'
    );
    const third = saveHighlight(
      'story-b',
      firstAnchor,
      window.localStorage,
      () => new Date('2026-06-29T10:03:00.000Z'),
      () => 'highlight-3'
    );

    expect(first).toEqual({
      highlightId: 'highlight-1',
      storyId: 'story-a',
      quote: 'beta gamma',
      prefix: 'lpha ',
      suffix: ' delt',
      createdAt: '2026-06-29T10:00:00.000Z'
    });
    expect(duplicate).toEqual(first);
    expect(loadHighlights('story-a')).toEqual([second, first]);
    expect(loadHighlights('story-b')).toEqual([third]);

    removeHighlight('story-a', 'highlight-2');

    expect(loadHighlights('story-a')).toEqual([first]);

    removeHighlights('story-a');

    expect(loadHighlights('story-a')).toEqual([]);
    expect(loadHighlights('story-b')).toEqual([third]);
  });

  it('renders stored highlights into html', () => {
    const html = '<p>Alpha beta gamma delta epsilon</p><p>Alpha beta gamma delta zeta</p>';
    const first = saveHighlight(
      'story-a',
      createHighlightAnchor('Alpha beta gamma delta epsilon', 6, 16, 12),
      window.localStorage,
      () => new Date('2026-06-29T10:00:00.000Z'),
      () => 'highlight-1'
    );
    const second = saveHighlight(
      'story-a',
      createHighlightAnchor('Alpha beta gamma delta zeta', 6, 16, 12),
      window.localStorage,
      () => new Date('2026-06-29T10:01:00.000Z'),
      () => 'highlight-2'
    );

    const rendered = renderHighlightsOnHtml(html, [first, second]);

    expect(rendered).toContain('data-highlight-id="highlight-1"');
    expect(rendered).toContain('data-highlight-id="highlight-2"');
    expect(rendered.match(/<mark /g)).toHaveLength(2);
  });

  it('leaves html unchanged when highlight cannot be resolved', () => {
    const html = '<p>Alpha beta gamma delta epsilon</p>';

    const rendered = renderHighlightsOnHtml(html, [
      {
        highlightId: 'missing',
        storyId: 'story-a',
        quote: 'zeta',
        prefix: 'Alpha ',
        suffix: ' omega',
        createdAt: '2026-06-29T10:00:00.000Z'
      }
    ]);

    expect(rendered).toBe(html);
  });
});
