import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Bookmark, FileText, Library, Trash2 } from 'lucide-react';
import './styles.css';
import { ReaderControls } from './components/ReaderControls';
import { type ParsedNovel, parseNovelFile } from './lib/fileReaders';
import { importGoogleDriveFile } from './lib/googleDrive';
import { type LibraryItem, createLibraryId, loadLibrary, removeFromLibrary, saveToLibrary } from './lib/library';
import {
  type NumericPreference,
  type ReaderPreferences,
  type ThemeName,
  clampPreference,
  defaultPreferences,
  nextTheme
} from './lib/preferences';
import {
  calculateReadingProgress,
  calculateScrollTopForProgress,
  formatReadingProgress,
  loadReadingBookmark,
  loadReadingProgress,
  removeReadingBookmark,
  removeReadingProgress,
  saveReadingBookmark,
  saveReadingProgress
} from './lib/readingProgress';

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
  const [readingProgress, setReadingProgress] = useState(0);
  const [bookmarkRatio, setBookmarkRatio] = useState<number | null>(null);
  const resumeProgressRef = useRef<number | null>(null);
  const isRestoringProgressRef = useRef(false);

  const readerStyle = useMemo(
    () => ({
      fontSize: `${preferences.fontSize}px`,
      lineHeight: preferences.lineHeight,
      maxWidth: `${preferences.contentWidth}ch`
    }),
    [preferences]
  );

  useEffect(() => {
    if (!novel?.id || activeTab !== 'reader') return;

    const resumeRatio = resumeProgressRef.current;
    resumeProgressRef.current = null;
    if (resumeRatio === null) return;

    isRestoringProgressRef.current = true;
    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({
        top: calculateScrollTopForProgress(
          resumeRatio,
          document.documentElement.scrollHeight,
          window.innerHeight
        ),
        behavior: 'auto'
      });
      setReadingProgress(resumeRatio);
      window.setTimeout(() => {
        isRestoringProgressRef.current = false;
      }, 0);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      isRestoringProgressRef.current = false;
    };
  }, [activeTab, novel?.id]);

  useEffect(() => {
    const novelId = novel?.id;
    if (!novelId || activeTab !== 'reader') return;

    let frameId: number | null = null;

    const syncProgress = () => {
      frameId = null;
      if (isRestoringProgressRef.current) return;

      const ratio = calculateReadingProgress(window.scrollY, document.documentElement.scrollHeight, window.innerHeight);
      setReadingProgress(ratio);
      saveReadingProgress(novelId, ratio);
    };

    const requestSync = () => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(syncProgress);
    };

    window.addEventListener('scroll', requestSync, { passive: true });
    window.addEventListener('resize', requestSync);

    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      window.removeEventListener('scroll', requestSync);
      window.removeEventListener('resize', requestSync);
    };
  }, [activeTab, novel?.id]);

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
    const novelWithId = { ...parsed, id: parsed.id ?? createLibraryId(parsed) };
    const savedProgress = loadReadingProgress(novelWithId.id);
    const progressRatio = savedProgress?.ratio ?? 0;
    const savedBookmark = loadReadingBookmark(novelWithId.id);

    resumeProgressRef.current = progressRatio;
    setReadingProgress(progressRatio);
    setBookmarkRatio(savedBookmark?.ratio ?? null);
    setNovel(novelWithId);
    setActiveTab('reader');

    try {
      setLibrary(saveToLibrary(novelWithId));
      setStatus(`${message}${progressRatio > 0 ? ` Resumed at ${formatReadingProgress(progressRatio)}.` : ''} Saved to library.`);
    } catch {
      setStatus(`${message} Opened, but it is too large to save in this browser's local library.`);
    }
  }

  function openLibraryItem(item: LibraryItem) {
    const savedProgress = loadReadingProgress(item.id);
    const progressRatio = savedProgress?.ratio ?? 0;
    const savedBookmark = loadReadingBookmark(item.id);

    resumeProgressRef.current = progressRatio;
    setReadingProgress(progressRatio);
    setBookmarkRatio(savedBookmark?.ratio ?? null);
    setNovel(item);
    setActiveTab('reader');
    setStatus(`Opened ${item.title} from library.${progressRatio > 0 ? ` Resumed at ${formatReadingProgress(progressRatio)}.` : ''}`);
  }

  function removeLibraryItem(id: string) {
    removeReadingProgress(id);
    removeReadingBookmark(id);
    setLibrary(removeFromLibrary(id));
    if (novel?.id === id) {
      setNovel(null);
      setReadingProgress(0);
      setBookmarkRatio(null);
      resumeProgressRef.current = null;
    }
    setStatus('Removed from library.');
  }

  function captureCurrentProgress() {
    return calculateReadingProgress(window.scrollY, document.documentElement.scrollHeight, window.innerHeight);
  }

  function addBookmark() {
    if (!novel?.id) return;

    const ratio = captureCurrentProgress();
    saveReadingProgress(novel.id, ratio);
    saveReadingBookmark(novel.id, ratio);
    setReadingProgress(ratio);
    setBookmarkRatio(ratio);
    setStatus(`Bookmarked ${formatReadingProgress(ratio)} in ${novel.title}.`);
  }

  function jumpToBookmark() {
    if (bookmarkRatio === null) return;

    window.scrollTo({
      top: calculateScrollTopForProgress(bookmarkRatio, document.documentElement.scrollHeight, window.innerHeight),
      behavior: 'smooth'
    });
    setReadingProgress(bookmarkRatio);
    setStatus(`Jumped to bookmark at ${formatReadingProgress(bookmarkRatio)}.`);
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
        <span className="status-message">
          <FileText size={18} /> {status}
        </span>
        {novel ? (
          <div className="status-actions">
            <span className="progress-pill" aria-label="Reading progress">
              Progress {formatReadingProgress(readingProgress)}
            </span>
            {bookmarkRatio !== null ? (
              <button type="button" className="bookmark-button" onClick={jumpToBookmark}>
                <Bookmark size={16} /> Bookmark {formatReadingProgress(bookmarkRatio)}
              </button>
            ) : null}
            <button type="button" className="bookmark-button" onClick={addBookmark}>
              <Bookmark size={16} /> Add bookmark
            </button>
          </div>
        ) : null}
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
              {library.map((item) => {
                const itemProgress = loadReadingProgress(item.id)?.ratio ?? 0;
                const itemBookmark = loadReadingBookmark(item.id)?.ratio ?? null;

                return (
                  <article className="library-card" key={item.id}>
                    <div>
                      <strong>{item.title}</strong>
                      <span>
                        {item.kind.toUpperCase()} · {item.source === 'google-drive' ? 'Google Drive' : 'Local file'}
                      </span>
                      <small>Saved {new Date(item.savedAt).toLocaleString()}</small>
                      <small>Progress {formatReadingProgress(itemProgress)}</small>
                      {itemBookmark !== null ? <small>Bookmark {formatReadingProgress(itemBookmark)}</small> : null}
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
                );
              })}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

export default App;
