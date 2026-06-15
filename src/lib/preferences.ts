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
