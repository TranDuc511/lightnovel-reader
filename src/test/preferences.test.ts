import { describe, expect, it } from 'vitest';
import { clampPreference, defaultPreferences } from '../lib/preferences';

describe('reader preferences', () => {
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
});
