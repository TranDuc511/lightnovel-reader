import { beforeEach, describe, expect, it } from 'vitest';
import { clampPreference, defaultPreferences, loadPreferences, savePreferences } from '../lib/preferences';

describe('reader preferences', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('keeps default preferences comfortable for prose reading', () => {
    expect(defaultPreferences.theme).toBe('sepia');
    expect(defaultPreferences.fontSize).toBeGreaterThanOrEqual(18);
    expect(defaultPreferences.lineHeight).toBeGreaterThanOrEqual(1.6);
  });

  it('clamps preference values to usable bounds', () => {
    expect(clampPreference('fontSize', 5)).toBe(14);
    expect(clampPreference('fontSize', 40)).toBe(28);
    expect(clampPreference('contentWidth', 20)).toBe(52);
    expect(clampPreference('lineHeight', 3)).toBe(2.1);
  });

  it('saves and restores preferences', () => {
    const preferences = savePreferences({ theme: 'dark', fontSize: 24, lineHeight: 1.9, contentWidth: 80 });

    expect(preferences).toEqual({ theme: 'dark', fontSize: 24, lineHeight: 1.9, contentWidth: 80 });
    expect(loadPreferences()).toEqual(preferences);
  });

  it('falls back safely from malformed storage', () => {
    window.localStorage.setItem('lightnovel-reader.preferences.v1', '{not valid json');

    expect(loadPreferences()).toEqual(defaultPreferences);
  });

  it('falls back from invalid fields and clamps saved numeric values', () => {
    window.localStorage.setItem(
      'lightnovel-reader.preferences.v1',
      JSON.stringify({ theme: 'unknown', fontSize: 40, lineHeight: 'dense', contentWidth: 20 })
    );

    expect(loadPreferences()).toEqual({ ...defaultPreferences, fontSize: 28, contentWidth: 52 });
  });
});
