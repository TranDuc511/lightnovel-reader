import { describe, expect, it } from 'vitest';
import type { ParsedNovel } from '../lib/fileReaders';
import { loadLibrary, removeFromLibrary, saveToLibrary } from '../lib/library';

describe('local story library', () => {
  it('saves novels newest-first and replaces existing entries by id', () => {
    const storage = new MemoryStorage();
    const first = createNovel('one', 'First Novel');
    const second = createNovel('two', 'Second Novel');

    saveToLibrary(first, storage);
    saveToLibrary(second, storage);
    saveToLibrary({ ...first, title: 'First Novel Updated' }, storage);

    const library = loadLibrary(storage);
    expect(library).toHaveLength(2);
    expect(library[0].id).toBe('one');
    expect(library[0].title).toBe('First Novel Updated');
    expect(library[1].id).toBe('two');
  });

  it('removes a saved novel from the library', () => {
    const storage = new MemoryStorage();
    saveToLibrary(createNovel('one', 'First Novel'), storage);
    saveToLibrary(createNovel('two', 'Second Novel'), storage);

    removeFromLibrary('one', storage);

    expect(loadLibrary(storage).map((item) => item.id)).toEqual(['two']);
  });
});

function createNovel(id: string, title: string): ParsedNovel {
  return {
    id,
    title,
    kind: 'markdown',
    html: `<h1>${title}</h1>`,
    rawText: title,
    source: 'local',
    savedAt: '2026-06-17T00:00:00.000Z'
  };
}

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}
