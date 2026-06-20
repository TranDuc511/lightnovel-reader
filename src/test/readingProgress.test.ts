import { describe, expect, it, beforeEach } from 'vitest';
import {
  calculateReadingProgress,
  calculateScrollTopForProgress,
  formatReadingProgress,
  loadReadingBookmark,
  loadReadingProgress,
  removeReadingBookmark,
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

  it('saves, loads, clamps, and removes bookmarks for each story id', () => {
    const saved = saveReadingBookmark('story-a', 0.625, window.localStorage, () => new Date('2026-06-20T12:00:00.000Z'));
    saveReadingBookmark('story-b', 2, window.localStorage, () => new Date('2026-06-20T12:01:00.000Z'));

    expect(saved).toEqual({
      id: 'story-a',
      ratio: 0.625,
      createdAt: '2026-06-20T12:00:00.000Z'
    });
    expect(loadReadingBookmark('story-a')).toEqual(saved);
    expect(loadReadingBookmark('story-b')?.ratio).toBe(1);

    removeReadingBookmark('story-a');

    expect(loadReadingBookmark('story-a')).toBeNull();
    expect(loadReadingBookmark('story-b')?.ratio).toBe(1);
  });

  it('formats progress for display', () => {
    expect(formatReadingProgress(0)).toBe('0%');
    expect(formatReadingProgress(0.456)).toBe('46%');
    expect(formatReadingProgress(1)).toBe('100%');
  });
});
