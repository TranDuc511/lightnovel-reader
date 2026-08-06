import { useState } from 'react';
import { Cloud, Eye, EyeOff, Minus, Moon, Plus, Settings2, Upload } from 'lucide-react';
import type {
  NumericPreference,
  PageDirection,
  ReaderPreferences,
  SpreadMode,
  TextDirection,
  ThemeName
} from '../lib/preferences';

export type ReaderControlsProps = {
  preferences: ReaderPreferences;
  onThemeChange: (theme: ThemeName) => void;
  onImageVisibilityChange: () => void;
  onPreferenceChange: (key: NumericPreference, delta: number) => void;
  onPageDirectionChange: (direction: PageDirection) => void;
  onTextDirectionChange: (direction: TextDirection) => void;
  onSpreadModeChange: (mode: SpreadMode) => void;
  onFileSelect: (file: File) => void;
  onDriveImport: (url: string) => void;
};

export function ReaderControls({
  preferences,
  onThemeChange,
  onImageVisibilityChange,
  onPreferenceChange,
  onPageDirectionChange,
  onTextDirectionChange,
  onSpreadModeChange,
  onFileSelect,
  onDriveImport
}: ReaderControlsProps) {
  const [driveUrl, setDriveUrl] = useState('');

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

      <form
        className="drive-import"
        onSubmit={(event) => {
          event.preventDefault();
          if (!driveUrl.trim()) return;
          onDriveImport(driveUrl.trim());
          setDriveUrl('');
        }}
      >
        <Cloud size={18} />
        <input
          aria-label="Google Drive sharing link"
          placeholder="Google Drive link"
          value={driveUrl}
          onChange={(event) => setDriveUrl(event.currentTarget.value)}
        />
        <button type="submit">Import</button>
      </form>

      <details className="display-settings">
        <summary>
          <Settings2 size={18} />
          Display
        </summary>
        <div className="display-settings-panel">
          <div className="settings-actions">
            <button type="button" onClick={() => onThemeChange(preferences.theme)}>
              <Moon size={18} /> Switch theme
            </button>

            <button
              type="button"
              className={!preferences.showImages ? 'active' : ''}
              aria-pressed={!preferences.showImages}
              onClick={onImageVisibilityChange}
            >
              {preferences.showImages ? <EyeOff size={18} /> : <Eye size={18} />}
              {preferences.showImages ? 'Hide images' : 'Show images'}
            </button>
          </div>

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
            label="Text width"
            value={`${preferences.contentWidth}ch`}
            onDecrease={() => onPreferenceChange('contentWidth', -4)}
            onIncrease={() => onPreferenceChange('contentWidth', 4)}
          />

          <OptionGroup
            label="Page turn"
            value={preferences.pageDirection}
            options={[
              ['ltr', 'Left to right'],
              ['rtl', 'Right to left']
            ]}
            onChange={(value) => onPageDirectionChange(value as PageDirection)}
          />
          <OptionGroup
            label="Text"
            value={preferences.textDirection}
            options={[
              ['auto', 'Auto'],
              ['ltr', 'LTR'],
              ['rtl', 'RTL']
            ]}
            onChange={(value) => onTextDirectionChange(value as TextDirection)}
          />
          <OptionGroup
            label="Pages"
            value={preferences.spreadMode}
            options={[
              ['auto', 'Auto'],
              ['single', 'Single'],
              ['double', 'Double']
            ]}
            onChange={(value) => onSpreadModeChange(value as SpreadMode)}
          />
        </div>
      </details>
    </aside>
  );
}

function OptionGroup({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: Array<[value: string, label: string]>;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="option-group">
      <legend>{label}</legend>
      <div>
        {options.map(([optionValue, optionLabel]) => (
          <button
            key={optionValue}
            type="button"
            className={value === optionValue ? 'active' : ''}
            aria-pressed={value === optionValue}
            onClick={() => onChange(optionValue)}
          >
            {optionLabel}
          </button>
        ))}
      </div>
    </fieldset>
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
