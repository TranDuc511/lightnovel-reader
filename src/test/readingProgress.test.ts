import { beforeEach, describe, expect, it } from 'vitest';
import {
  calculateReadingProgress,
  calculateScrollTopForProgress,
  formatReadingProgress,
  loadReadingBookmarks,
  loadReadingProgress,
  removeReadingBookmark,
  removeReadingBookmarks,
  removeReadingProgress,
  saveReadingBookmark,
  saveReadingProgress
} from '../lib/readingProgress';

describe('reading progress helpers', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('calculates scroll progress as a clamped ratio', () => {
    expect(calculateReadingProgress(250, 1000, 500)).toBe(0.5);
    expect(calculateReadingProgress(-20, 1000, 500)).toBe(0);
    expect(calculateReadingProgress(900, 1000, 500)).toBe(1);
    expect(calculateReadingProgress(0, 500, 500)).toBe(0);
  });

  it('calculates scroll position needed to resume a saved ratio', () => {
    expect(calculateScrollTopForProgress(0.5, 1000, 500)).toBe(250);
    expect(calculateScrollTopForProgress(-1, 1000, 500)).toBe(0);
    expect(calculateScrollTopForProgress(2, 1000, 500)).toBe(500);
    expect(calculateScrollTopForProgress(0.5, 500, 500)).toBe(0);
  });

  it('saves and loads progress for each story id', () => {
    const saved = saveReadingProgress('story-a', 0.456, window.localStorage, () => new Date('2026-06-20T12:00:00.000Z'));

    expect(saved).toEqual({
      id: 'story-a',
      ratio: 0.456,
      updatedAt: '2026-06-20T12:00:00.000Z'
    });
    expect(loadReadingProgress('story-a')).toEqual(saved);
    expect(loadReadingProgress('missing')).toBeNull();
  });

  it('clamps saved ratios and removes progress entries', () => {
    saveReadingProgress('story-a', 2, window.localStorage, () => new Date('2026-06-20T12:00:00.000Z'));
    saveReadingProgress('story-b', 0.25, window.localStorage, () => new Date('2026-06-20T12:01:00.000Z'));

    expect(loadReadingProgress('story-a')?.ratio).toBe(1);

    removeReadingProgress('story-a');

    expect(loadReadingProgress('story-a')).toBeNull();
    expect(loadReadingProgress('story-b')?.ratio).toBe(0.25);
  });

  it('saves, loads, and removes multiple bookmarks for each story id', () => {
    const first = saveReadingBookmark(
      'story-a',
      0.25,
      window.localStorage,
      () => new Date('2026-06-20T12:00:00.000Z'),
      () => 'bookmark-1'
    );
    const second = saveReadingBookmark(
      'story-a',
      0.625,
      window.localStorage,
      () => new Date('2026-06-20T12:01:00.000Z'),
      () => 'bookmark-2'
    );
    const third = saveReadingBookmark(
      'story-b',
      2,
      window.localStorage,
      () => new Date('2026-06-20T12:02:00.000Z'),
      () => 'bookmark-3'
    );

    expect(first).toEqual({
      bookmarkId: 'bookmark-1',
      id: 'story-a',
      ratio: 0.25,
      createdAt: '2026-06-20T12:00:00.000Z'
    });
    expect(second).toEqual({
      bookmarkId: 'bookmark-2',
      id: 'story-a',
      ratio: 0.625,
      createdAt: '2026-06-20T12:01:00.000Z'
    });
    expect(third.ratio).toBe(1);
    expect(loadReadingBookmarks('story-a')).toEqual([second, first]);
    expect(loadReadingBookmarks('story-b')).toEqual([third]);

    removeReadingBookmark('story-a', 'bookmark-2');

    expect(loadReadingBookmarks('story-a')).toEqual([first]);

    removeReadingBookmarks('story-a');

    expect(loadReadingBookmarks('story-a')).toEqual([]);
    expect(loadReadingBookmarks('story-b')).toEqual([third]);
  });

  it('formats progress for display', () => {
    expect(formatReadingProgress(0)).toBe('0%');
    expect(formatReadingProgress(0.456)).toBe('46%');
    expect(formatReadingProgress(1)).toBe('100%');
  });
});
