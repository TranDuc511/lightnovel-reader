export type ReadingProgress = {
  id: string;
  ratio: number;
  updatedAt: string;
};

export type ReadingBookmark = {
  id: string;
  ratio: number;
  createdAt: string;
};

const READING_PROGRESS_STORAGE_KEY = 'lightnovel-reader.reading-progress.v1';
const READING_BOOKMARK_STORAGE_KEY = 'lightnovel-reader.bookmarks.v1';

type ProgressMap = Record<string, ReadingProgress>;
type BookmarkMap = Record<string, ReadingBookmark>;

export function calculateReadingProgress(scrollTop: number, scrollHeight: number, clientHeight: number): number {
  const scrollableHeight = scrollHeight - clientHeight;
  if (!Number.isFinite(scrollableHeight) || scrollableHeight <= 0) return 0;

  return clampRatio(scrollTop / scrollableHeight);
}

export function calculateScrollTopForProgress(ratio: number, scrollHeight: number, clientHeight: number): number {
  const scrollableHeight = scrollHeight - clientHeight;
  if (!Number.isFinite(scrollableHeight) || scrollableHeight <= 0) return 0;

  return Math.round(clampRatio(ratio) * scrollableHeight);
}

export function formatReadingProgress(ratio: number): string {
  return `${Math.round(clampRatio(ratio) * 100)}%`;
}

export function loadReadingProgress(id: string, storage: Storage = window.localStorage): ReadingProgress | null {
  return readProgressMap(storage)[id] ?? null;
}

export function loadReadingBookmark(id: string, storage: Storage = window.localStorage): ReadingBookmark | null {
  return readBookmarkMap(storage)[id] ?? null;
}

export function saveReadingProgress(
  id: string,
  ratio: number,
  storage: Storage = window.localStorage,
  now: () => Date = () => new Date()
): ReadingProgress {
  const progress: ReadingProgress = {
    id,
    ratio: clampRatio(ratio),
    updatedAt: now().toISOString()
  };
  const progressMap = readProgressMap(storage);
  storage.setItem(READING_PROGRESS_STORAGE_KEY, JSON.stringify({ ...progressMap, [id]: progress }));
  return progress;
}

export function removeReadingProgress(id: string, storage: Storage = window.localStorage): void {
  const progressMap = readProgressMap(storage);
  delete progressMap[id];
  storage.setItem(READING_PROGRESS_STORAGE_KEY, JSON.stringify(progressMap));
}

export function saveReadingBookmark(
  id: string,
  ratio: number,
  storage: Storage = window.localStorage,
  now: () => Date = () => new Date()
): ReadingBookmark {
  const bookmark: ReadingBookmark = {
    id,
    ratio: clampRatio(ratio),
    createdAt: now().toISOString()
  };
  const bookmarkMap = readBookmarkMap(storage);
  storage.setItem(READING_BOOKMARK_STORAGE_KEY, JSON.stringify({ ...bookmarkMap, [id]: bookmark }));
  return bookmark;
}

export function removeReadingBookmark(id: string, storage: Storage = window.localStorage): void {
  const bookmarkMap = readBookmarkMap(storage);
  delete bookmarkMap[id];
  storage.setItem(READING_BOOKMARK_STORAGE_KEY, JSON.stringify(bookmarkMap));
}

function readProgressMap(storage: Storage): ProgressMap {
  const raw = storage.getItem(READING_PROGRESS_STORAGE_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, ReadingProgress] => isReadingProgress(entry[1]))
    );
  } catch {
    return {};
  }
}

function readBookmarkMap(storage: Storage): BookmarkMap {
  const raw = storage.getItem(READING_BOOKMARK_STORAGE_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, ReadingBookmark] => isReadingBookmark(entry[1]))
    );
  } catch {
    return {};
  }
}

function isReadingProgress(value: unknown): value is ReadingProgress {
  if (!value || typeof value !== 'object') return false;
  const progress = value as Record<string, unknown>;
  return (
    typeof progress.id === 'string' &&
    typeof progress.ratio === 'number' &&
    progress.ratio >= 0 &&
    progress.ratio <= 1 &&
    typeof progress.updatedAt === 'string'
  );
}

function isReadingBookmark(value: unknown): value is ReadingBookmark {
  if (!value || typeof value !== 'object') return false;
  const bookmark = value as Record<string, unknown>;
  return (
    typeof bookmark.id === 'string' &&
    typeof bookmark.ratio === 'number' &&
    bookmark.ratio >= 0 &&
    bookmark.ratio <= 1 &&
    typeof bookmark.createdAt === 'string'
  );
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
