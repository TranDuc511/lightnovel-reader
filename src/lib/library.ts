import type { ParsedNovel } from './fileReaders';

const LIBRARY_STORAGE_KEY = 'lightnovel-reader.library.v1';

export type LibraryItem = ParsedNovel & {
  id: string;
  savedAt: string;
};

export function loadLibrary(storage: Storage = window.localStorage): LibraryItem[] {
  const raw = storage.getItem(LIBRARY_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isLibraryItem) : [];
  } catch {
    return [];
  }
}

export function saveToLibrary(novel: ParsedNovel, storage: Storage = window.localStorage): LibraryItem[] {
  const item: LibraryItem = {
    ...novel,
    id: novel.id ?? createLibraryId(novel),
    savedAt: new Date().toISOString()
  };
  const existing = loadLibrary(storage).filter((entry) => entry.id !== item.id);
  const next = [item, ...existing];
  storage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function removeFromLibrary(id: string, storage: Storage = window.localStorage): LibraryItem[] {
  const next = loadLibrary(storage).filter((entry) => entry.id !== id);
  storage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function createLibraryId(novel: Pick<ParsedNovel, 'title' | 'kind' | 'rawText'>): string {
  return `${novel.kind}:${slugify(novel.title)}:${hashString(novel.rawText).toString(36)}`;
}

function isLibraryItem(value: unknown): value is LibraryItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    typeof item.kind === 'string' &&
    typeof item.html === 'string' &&
    typeof item.rawText === 'string' &&
    typeof item.savedAt === 'string'
  );
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'untitled';
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}
