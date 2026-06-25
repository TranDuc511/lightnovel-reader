export type ReadingProgress = {
  id: string;
  ratio: number;
  updatedAt: string;
};

export type ReadingBookmark = {
  bookmarkId: string;
  id: string;
  ratio: number;
  createdAt: string;
};

const READING_PROGRESS_STORAGE_KEY = 'lightnovel-reader.reading-progress.v1';
const READING_BOOKMARK_STORAGE_KEY = 'lightnovel-reader.bookmarks.v1';

type ProgressMap = Record<string, ReadingProgress>;
type BookmarkMap = Record<string, ReadingBookmark[]>;

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

export function loadReadingBookmarks(id: string, storage: Storage = window.localStorage): ReadingBookmark[] {
  return readBookmarkMap(storage)[id] ?? [];
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
  now: () => Date = () => new Date(),
  createBookmarkId: () => string = defaultCreateBookmarkId
): ReadingBookmark {
  const bookmark: ReadingBookmark = {
    bookmarkId: createBookmarkId(),
    id,
    ratio: clampRatio(ratio),
    createdAt: now().toISOString()
  };
  const bookmarkMap = readBookmarkMap(storage);
  const nextBookmarks = sortBookmarks([bookmark, ...(bookmarkMap[id] ?? [])]);

  storage.setItem(READING_BOOKMARK_STORAGE_KEY, JSON.stringify({ ...bookmarkMap, [id]: nextBookmarks }));
  return bookmark;
}

export function removeReadingBookmark(id: string, bookmarkId: string, storage: Storage = window.localStorage): void {
  const bookmarkMap = readBookmarkMap(storage);
  const nextBookmarks = (bookmarkMap[id] ?? []).filter((bookmark) => bookmark.bookmarkId !== bookmarkId);

  if (nextBookmarks.length === 0) {
    delete bookmarkMap[id];
  } else {
    bookmarkMap[id] = nextBookmarks;
  }

  storage.setItem(READING_BOOKMARK_STORAGE_KEY, JSON.stringify(bookmarkMap));
}

export function removeReadingBookmarks(id: string, storage: Storage = window.localStorage): void {
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
      Object.entries(parsed)
        .map(([storyId, value]) => [storyId, normalizeBookmarks(storyId, value)] as const)
        .filter((entry): entry is [string, ReadingBookmark[]] => entry[1].length > 0)
    );
  } catch {
    return {};
  }
}

function normalizeBookmarks(storyId: string, value: unknown): ReadingBookmark[] {
  if (Array.isArray(value)) {
    return sortBookmarks(value.map((bookmark) => sanitizeBookmark(storyId, bookmark)).filter(isNonNullable));
  }

  const legacyBookmark = sanitizeBookmark(storyId, value);
  return legacyBookmark ? [legacyBookmark] : [];
}

function sanitizeBookmark(storyId: string, value: unknown): ReadingBookmark | null {
  if (!value || typeof value !== 'object') return null;

  const bookmark = value as Record<string, unknown>;
  const id = typeof bookmark.id === 'string' ? bookmark.id : storyId;
  const ratio = typeof bookmark.ratio === 'number' ? bookmark.ratio : null;
  const createdAt = typeof bookmark.createdAt === 'string' ? bookmark.createdAt : null;

  if (ratio === null || createdAt === null || ratio < 0 || ratio > 1) return null;

  const bookmarkId = typeof bookmark.bookmarkId === 'string' && bookmark.bookmarkId.length > 0
    ? bookmark.bookmarkId
    : `legacy-${id}-${createdAt}-${Math.round(ratio * 1000)}`;

  return {
    bookmarkId,
    id,
    ratio,
    createdAt
  };
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

function sortBookmarks(bookmarks: ReadingBookmark[]): ReadingBookmark[] {
  return [...bookmarks].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function defaultCreateBookmarkId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `bookmark-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function isNonNullable<T>(value: T | null | undefined): value is T {
  return value != null;
}
