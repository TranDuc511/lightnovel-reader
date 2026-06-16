import { Minus, Moon, Plus, Upload } from 'lucide-react';
import type { NumericPreference, ReaderPreferences, ThemeName } from '../lib/preferences';

export type ReaderControlsProps = {
  preferences: ReaderPreferences;
  onThemeChange: (theme: ThemeName) => void;
  onPreferenceChange: (key: NumericPreference, delta: number) => void;
  onFileSelect: (file: File) => void;
};

export function ReaderControls({
  preferences,
  onThemeChange,
  onPreferenceChange,
  onFileSelect
}: ReaderControlsProps) {
  return (
    <aside className="controls" aria-label="Reader settings">
      <label className="file-picker">
        <Upload size={18} />
        <span>Choose file</span>
        <input
          type="file"
          accept=".md,.markdown,.txt,.pdf,.epub,application/pdf,application/epub+zip,text/plain,text/markdown"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) onFileSelect(file);
          }}
        />
      </label>

      <button type="button" onClick={() => onThemeChange(preferences.theme)}>
        <Moon size={18} /> Switch theme
      </button>

      <ControlStepper
        label="Font size"
        value={`${preferences.fontSize}px`}
        onDecrease={() => onPreferenceChange('fontSize', -1)}
        onIncrease={() => onPreferenceChange('fontSize', 1)}
      />
      <ControlStepper
        label="Line height"
        value={preferences.lineHeight.toFixed(2)}
        onDecrease={() => onPreferenceChange('lineHeight', -0.05)}
        onIncrease={() => onPreferenceChange('lineHeight', 0.05)}
      />
      <ControlStepper
        label="Width"
        value={`${preferences.contentWidth}ch`}
        onDecrease={() => onPreferenceChange('contentWidth', -4)}
        onIncrease={() => onPreferenceChange('contentWidth', 4)}
      />
    </aside>
  );
}

function ControlStepper({
  label,
  value,
  onDecrease,
  onIncrease
}: {
  label: string;
  value: string;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <div className="stepper">
      <span>{label}</span>
      <div>
        <button type="button" aria-label={`Decrease ${label}`} onClick={onDecrease}>
          <Minus size={16} />
        </button>
        <output>{value}</output>
        <button type="button" aria-label={`Increase ${label}`} onClick={onIncrease}>
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}
