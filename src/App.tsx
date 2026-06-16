import { useMemo, useState } from 'react';
import { BookOpen, FileText } from 'lucide-react';
import './styles.css';
import { ReaderControls } from './components/ReaderControls';
import { type ParsedNovel, parseNovelFile } from './lib/fileReaders';
import {
  type NumericPreference,
  type ReaderPreferences,
  type ThemeName,
  clampPreference,
  defaultPreferences,
  nextTheme
} from './lib/preferences';

const sampleHtml = `
  <h1>Drop a light novel here</h1>
  <p>The app supports <strong>Markdown</strong>, <strong>TXT</strong>, and <strong>PDF</strong>. Files are processed directly in your browser and never uploaded to a server.</p>
  <p>Tip: use Markdown to preserve chapter titles, paragraphs, dialogue, and editing notes.</p>
`;

function App() {
  const [novel, setNovel] = useState<ParsedNovel | null>(null);
  const [preferences, setPreferences] = useState<ReaderPreferences>(defaultPreferences);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState('No file opened yet.');

  const readerStyle = useMemo(
    () => ({
      fontSize: `${preferences.fontSize}px`,
      lineHeight: preferences.lineHeight,
      maxWidth: `${preferences.contentWidth}ch`
    }),
    [preferences]
  );

  async function openFile(file: File) {
    try {
      setStatus(`Reading ${file.name}...`);
      const parsed = await parseNovelFile(file);
      setNovel(parsed);
      setStatus(`Opened ${parsed.title} (${parsed.kind}).`);
    } catch (error) {
      setNovel(null);
      setStatus(error instanceof Error ? error.message : 'Unable to read this file.');
    }
  }

  function updatePreference(key: NumericPreference, delta: number) {
    setPreferences((current) => ({
      ...current,
      [key]: Number(clampPreference(key, current[key] + delta).toFixed(2))
    }));
  }

  function cycleTheme(_: ThemeName) {
    setPreferences((current) => ({ ...current, theme: nextTheme(current.theme) }));
  }

  return (
    <main
      className={`app theme-${preferences.theme} ${isDragging ? 'dragging' : ''}`}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        const file = event.dataTransfer.files[0];
        if (file) void openFile(file);
      }}
    >
      <header className="topbar">
        <div className="brand">
          <BookOpen size={28} />
          <div>
            <strong>Light Novel Reader</strong>
            <span>MD · TXT · PDF</span>
          </div>
        </div>
        <ReaderControls
          preferences={preferences}
          onThemeChange={cycleTheme}
          onPreferenceChange={updatePreference}
          onFileSelect={(file) => void openFile(file)}
        />
      </header>

      <section className="status" role="status">
        <FileText size={18} /> {status}
      </section>

      <article className="reader" style={readerStyle}>
        <div dangerouslySetInnerHTML={{ __html: novel?.html ?? sampleHtml }} />
      </article>
    </main>
  );
}

export default App;
