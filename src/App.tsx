import { useMemo, useState } from 'react';
import { BookOpen, FileText, Library, Trash2 } from 'lucide-react';
import './styles.css';
import { ReaderControls } from './components/ReaderControls';
import { type ParsedNovel, parseNovelFile } from './lib/fileReaders';
import { importGoogleDriveFile } from './lib/googleDrive';
import { type LibraryItem, loadLibrary, removeFromLibrary, saveToLibrary } from './lib/library';
import {
  type NumericPreference,
  type ReaderPreferences,
  type ThemeName,
  clampPreference,
  defaultPreferences,
  nextTheme
} from './lib/preferences';

type ActiveTab = 'reader' | 'library';

const sampleHtml = `
  <h1>Drop a light novel here</h1>
  <p>The app supports <strong>Markdown</strong>, <strong>TXT</strong>, <strong>PDF</strong>, and <strong>EPUB</strong>. Files are processed directly in your browser and never uploaded to a server.</p>
  <p>You can also import a public Google Drive sharing link and keep opened stories in the local library.</p>
`;

function App() {
  const [novel, setNovel] = useState<ParsedNovel | null>(null);
  const [library, setLibrary] = useState<LibraryItem[]>(() => loadLibrary());
  const [activeTab, setActiveTab] = useState<ActiveTab>('reader');
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

  async function openFile(file: File, source: ParsedNovel['source'] = 'local') {
    try {
      setStatus(`Reading ${file.name}...`);
      const parsed = { ...(await parseNovelFile(file)), source };
      openParsedNovel(parsed, `Opened ${parsed.title} (${parsed.kind}).`);
    } catch (error) {
      setNovel(null);
      setStatus(error instanceof Error ? error.message : 'Unable to read this file.');
    }
  }

  async function importFromDrive(url: string) {
    try {
      setStatus('Downloading from Google Drive...');
      const file = await importGoogleDriveFile(url);
      await openFile(file, 'google-drive');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to import from Google Drive.');
    }
  }

  function openParsedNovel(parsed: ParsedNovel, message: string) {
    setNovel(parsed);
    setActiveTab('reader');

    try {
      setLibrary(saveToLibrary(parsed));
      setStatus(`${message} Saved to library.`);
    } catch {
      setStatus(`${message} Opened, but it is too large to save in this browser's local library.`);
    }
  }

  function openLibraryItem(item: LibraryItem) {
    setNovel(item);
    setActiveTab('reader');
    setStatus(`Opened ${item.title} from library.`);
  }

  function removeLibraryItem(id: string) {
    setLibrary(removeFromLibrary(id));
    if (novel?.id === id) setNovel(null);
    setStatus('Removed from library.');
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
            <span>MD · TXT · PDF · EPUB · Drive</span>
          </div>
        </div>
        <ReaderControls
          preferences={preferences}
          onThemeChange={cycleTheme}
          onPreferenceChange={updatePreference}
          onFileSelect={(file) => void openFile(file)}
          onDriveImport={(url) => void importFromDrive(url)}
        />
      </header>

      <section className="status" role="status">
        <FileText size={18} /> {status}
      </section>

      <nav className="tabs" aria-label="Reader tabs">
        <button
          type="button"
          className={activeTab === 'reader' ? 'active' : ''}
          onClick={() => setActiveTab('reader')}
        >
          <BookOpen size={18} /> Reader
        </button>
        <button
          type="button"
          className={activeTab === 'library' ? 'active' : ''}
          onClick={() => setActiveTab('library')}
        >
          <Library size={18} /> Library ({library.length})
        </button>
      </nav>

      {activeTab === 'reader' ? (
        <article className="reader" style={readerStyle}>
          <div dangerouslySetInnerHTML={{ __html: novel?.html ?? sampleHtml }} />
        </article>
      ) : (
        <section className="library-panel" aria-label="Saved story library">
          <header>
            <h2>Library</h2>
            <p>Stories are saved locally in this browser/app profile.</p>
          </header>

          {library.length === 0 ? (
            <p className="empty-library">No saved stories yet. Open a local file or import from Google Drive.</p>
          ) : (
            <div className="library-grid">
              {library.map((item) => (
                <article className="library-card" key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <span>
                      {item.kind.toUpperCase()} · {item.source === 'google-drive' ? 'Google Drive' : 'Local file'}
                    </span>
                    <small>Saved {new Date(item.savedAt).toLocaleString()}</small>
                  </div>
                  <div className="library-actions">
                    <button type="button" onClick={() => openLibraryItem(item)}>
                      Open
                    </button>
                    <button type="button" className="danger" onClick={() => removeLibraryItem(item.id)}>
                      <Trash2 size={16} /> Remove
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

export default App;
