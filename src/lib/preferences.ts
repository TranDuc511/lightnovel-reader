export type ThemeName = 'light' | 'sepia' | 'dark';

export type ReaderPreferences = {
  theme: ThemeName;
  fontSize: number;
  lineHeight: number;
  contentWidth: number;
};

export const defaultPreferences: ReaderPreferences = {
  theme: 'sepia',
  fontSize: 19,
  lineHeight: 1.75,
  contentWidth: 72
};

const READER_PREFERENCES_STORAGE_KEY = 'lightnovel-reader.preferences.v1';

const bounds = {
  fontSize: [14, 28],
  lineHeight: [1.4, 2.1],
  contentWidth: [52, 92]
} as const;

export type NumericPreference = keyof typeof bounds;

export function clampPreference(key: NumericPreference, value: number): number {
  const [min, max] = bounds[key];
  return Math.min(max, Math.max(min, value));
}

export function nextTheme(theme: ThemeName): ThemeName {
  if (theme === 'sepia') return 'dark';
  if (theme === 'dark') return 'light';
  return 'sepia';
}

export function loadPreferences(storage: Storage = window.localStorage): ReaderPreferences {
  const raw = storage.getItem(READER_PREFERENCES_STORAGE_KEY);
  if (!raw) return defaultPreferences;

  try {
    return normalizePreferences(JSON.parse(raw));
  } catch {
    return defaultPreferences;
  }
}

export function savePreferences(preferences: ReaderPreferences, storage: Storage = window.localStorage): ReaderPreferences {
  const saved = normalizePreferences(preferences);
  storage.setItem(READER_PREFERENCES_STORAGE_KEY, JSON.stringify(saved));
  return saved;
}

function normalizePreferences(value: unknown): ReaderPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaultPreferences;

  const preferences = value as Record<string, unknown>;
  return {
    theme: isThemeName(preferences.theme) ? preferences.theme : defaultPreferences.theme,
    fontSize: normalizeNumericPreference('fontSize', preferences.fontSize),
    lineHeight: normalizeNumericPreference('lineHeight', preferences.lineHeight),
    contentWidth: normalizeNumericPreference('contentWidth', preferences.contentWidth)
  };
}

function isThemeName(value: unknown): value is ThemeName {
  return value === 'light' || value === 'sepia' || value === 'dark';
}

function normalizeNumericPreference(key: NumericPreference, value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? clampPreference(key, value)
    : defaultPreferences[key];
}
