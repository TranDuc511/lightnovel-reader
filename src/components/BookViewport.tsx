import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { ArrowLeft, ArrowRight, Bookmark, ChevronLeft, ChevronRight } from 'lucide-react';
import type { PageDirection, SpreadMode, TextDirection } from '../lib/preferences';

type BookLayout = {
  viewportWidth: number;
  viewportHeight: number;
  pagesPerSpread: number;
  pageWidth: number;
  columnGap: number;
  pageStep: number;
  paddingX: number;
  paddingY: number;
};

export type BookViewportHandle = {
  getReaderElement: () => HTMLElement | null;
  getProgress: () => number;
  goToProgress: (ratio: number) => void;
  goToSelector: (selector: string) => boolean;
};

export type BookViewportProps = {
  contentKey: string;
  title: string;
  html: string;
  initialProgress: number;
  fontSize: number;
  lineHeight: number;
  contentWidth: number;
  showImages: boolean;
  pageDirection: PageDirection;
  textDirection: TextDirection;
  spreadMode: SpreadMode;
  toolbar?: ReactNode;
  onProgressChange: (ratio: number) => void;
  onAddBookmark?: () => void;
  onMouseUp?: (event: ReactMouseEvent<HTMLElement>) => void;
  onKeyUp?: () => void;
};

const emptyLayout: BookLayout = {
  viewportWidth: 0,
  viewportHeight: 0,
  pagesPerSpread: 1,
  pageWidth: 0,
  columnGap: 0,
  pageStep: 0,
  paddingX: 0,
  paddingY: 0
};

export const BookViewport = forwardRef<BookViewportHandle, BookViewportProps>(function BookViewport(
  {
    contentKey,
    title,
    html,
    initialProgress,
    fontSize,
    lineHeight,
    contentWidth,
    showImages,
    pageDirection,
    textDirection,
    spreadMode,
    toolbar,
    onProgressChange,
    onAddBookmark,
    onMouseUp,
    onKeyUp
  },
  ref
) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const readerRef = useRef<HTMLElement | null>(null);
  const pendingProgressRef = useRef(initialProgress);
  const onProgressChangeRef = useRef(onProgressChange);
  const [layout, setLayout] = useState<BookLayout>(emptyLayout);
  const [pageCount, setPageCount] = useState(1);
  const [currentPage, setCurrentPage] = useState(0);
  const [contentRevision, setContentRevision] = useState(0);
  const [isPaginationReady, setIsPaginationReady] = useState(false);

  const lastSpreadStart = Math.max(
    0,
    Math.floor((pageCount - 1) / layout.pagesPerSpread) * layout.pagesPerSpread
  );
  const canGoPrevious = currentPage > 0;
  const canGoNext = currentPage < lastSpreadStart;

  const setLogicalPage = useCallback(
    (page: number) => {
      const spreadStart = Math.floor(Math.max(0, Math.min(lastSpreadStart, page)) / layout.pagesPerSpread)
        * layout.pagesPerSpread;
      setCurrentPage(spreadStart);
    },
    [lastSpreadStart, layout.pagesPerSpread]
  );

  const goPrevious = useCallback(() => {
    setLogicalPage(currentPage - layout.pagesPerSpread);
  }, [currentPage, layout.pagesPerSpread, setLogicalPage]);

  const goNext = useCallback(() => {
    setLogicalPage(currentPage + layout.pagesPerSpread);
  }, [currentPage, layout.pagesPerSpread, setLogicalPage]);

  const getProgress = useCallback(() => {
    if (pageCount <= 1) return 0;
    return Math.min(1, currentPage / (pageCount - 1));
  }, [currentPage, pageCount]);

  const goToProgress = useCallback(
    (ratio: number) => {
      const normalized = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0));
      pendingProgressRef.current = normalized;
      setLogicalPage(Math.round(normalized * Math.max(0, pageCount - 1)));
    },
    [pageCount, setLogicalPage]
  );

  const getElementPage = useCallback(
    (element: HTMLElement) => {
      const reader = readerRef.current;
      if (!reader || layout.pageStep <= 0) return 0;

      const readerRect = reader.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const offset = pageDirection === 'rtl'
        ? readerRect.right - elementRect.right
        : elementRect.left - readerRect.left;

      return Math.max(0, Math.round(offset / layout.pageStep));
    },
    [layout.pageStep, pageDirection]
  );

  const goToSelector = useCallback(
    (selector: string) => {
      const element = readerRef.current?.querySelector(selector);
      if (!(element instanceof HTMLElement)) return false;
      setLogicalPage(getElementPage(element));
      return true;
    },
    [getElementPage, setLogicalPage]
  );

  useImperativeHandle(
    ref,
    () => ({
      getReaderElement: () => readerRef.current,
      getProgress,
      goToProgress,
      goToSelector
    }),
    [getProgress, goToProgress, goToSelector]
  );

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const updateLayout = () => {
      const viewportWidth = viewport.clientWidth;
      const viewportHeight = viewport.clientHeight;
      const supportsSpread = viewportWidth >= 900;
      const pagesPerSpread =
        spreadMode === 'single' || !supportsSpread
          ? 1
          : spreadMode === 'double' || viewportWidth >= 1040
            ? 2
            : 1;
      const spineGap = pagesPerSpread === 2 ? 24 : 20;
      const physicalPageWidth = (viewportWidth - spineGap * (pagesPerSpread - 1)) / pagesPerSpread;
      const widthFactor = (92 - contentWidth) / 40;
      const paddingX = Math.min(76, Math.max(24, physicalPageWidth * (0.06 + widthFactor * 0.08)));
      const paddingY = Math.min(58, Math.max(28, viewportHeight * 0.075));
      const pageWidth = Math.max(240, physicalPageWidth - paddingX * 2);
      const columnGap = paddingX * 2 + spineGap;

      const nextLayout = {
        viewportWidth,
        viewportHeight,
        pagesPerSpread,
        pageWidth,
        columnGap,
        pageStep: pageWidth + columnGap,
        paddingX,
        paddingY
      };
      setLayout((current) => {
        const changed = (Object.keys(nextLayout) as Array<keyof BookLayout>)
          .some((key) => current[key] !== nextLayout[key]);
        return changed ? nextLayout : current;
      });
    };

    updateLayout();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateLayout);
      return () => window.removeEventListener('resize', updateLayout);
    }

    const observer = new ResizeObserver(updateLayout);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [contentWidth, spreadMode]);

  useEffect(() => {
    pendingProgressRef.current = initialProgress;
    setCurrentPage(0);
    setPageCount(1);
    setIsPaginationReady(false);
  }, [contentKey]);

  useLayoutEffect(() => {
    const reader = readerRef.current;
    if (!reader || layout.pageStep <= 0) return;

    let frameId = window.requestAnimationFrame(() => {
      const contentWidth = Math.max(0, reader.scrollWidth - layout.paddingX * 2);
      const nextPageCount = Math.max(
        1,
        Math.ceil((contentWidth + layout.columnGap - 1) / layout.pageStep)
      );
      const targetPage = Math.round(pendingProgressRef.current * Math.max(0, nextPageCount - 1));

      setPageCount(nextPageCount);
      setCurrentPage(
        Math.floor(targetPage / layout.pagesPerSpread) * layout.pagesPerSpread
      );
      setIsPaginationReady(true);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [
    contentKey,
    contentRevision,
    fontSize,
    html,
    layout,
    lineHeight,
    pageDirection,
    showImages,
    textDirection
  ]);

  useEffect(() => {
    let cancelled = false;
    void document.fonts?.ready.then(() => {
      if (!cancelled) setContentRevision((revision) => revision + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [contentKey]);

  useEffect(() => {
    onProgressChangeRef.current = onProgressChange;
  }, [onProgressChange]);

  useEffect(() => {
    if (!isPaginationReady) return;
    const ratio = getProgress();
    pendingProgressRef.current = ratio;
    onProgressChangeRef.current(ratio);
  }, [getProgress, isPaginationReady]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, button, [contenteditable="true"]')) return;

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (pageDirection === 'ltr') goNext();
        else goPrevious();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (pageDirection === 'ltr') goPrevious();
        else goNext();
      } else if (event.key === 'PageDown' || (event.key === ' ' && !event.shiftKey)) {
        event.preventDefault();
        goNext();
      } else if (event.key === 'PageUp' || (event.key === ' ' && event.shiftKey)) {
        event.preventDefault();
        goPrevious();
      } else if (event.key === 'Home') {
        event.preventDefault();
        setLogicalPage(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        setLogicalPage(lastSpreadStart);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrevious, lastSpreadStart, pageDirection, setLogicalPage]);

  const transform = `${pageDirection === 'rtl' ? '' : '-'}${currentPage * layout.pageStep}px`;
  const visibleEndPage = Math.min(pageCount, currentPage + layout.pagesPerSpread);
  const pageLabel = layout.pagesPerSpread === 2 && visibleEndPage > currentPage + 1
    ? `Pages ${currentPage + 1}-${visibleEndPage} of ${pageCount}`
    : `Page ${currentPage + 1} of ${pageCount}`;

  const readerStyle = useMemo<CSSProperties>(
    () => ({
      width: `${layout.viewportWidth}px`,
      height: `${layout.viewportHeight}px`,
      padding: `${layout.paddingY}px ${layout.paddingX}px`,
      columnWidth: `${layout.pageWidth}px`,
      columnGap: `${layout.columnGap}px`,
      columnFill: 'auto',
      direction: pageDirection,
      fontSize: `${fontSize}px`,
      lineHeight,
      transform: `translate3d(${transform}, 0, 0)`
    }),
    [fontSize, layout, lineHeight, pageDirection, transform]
  );

  const leftAction = pageDirection === 'ltr' ? goPrevious : goNext;
  const rightAction = pageDirection === 'ltr' ? goNext : goPrevious;
  const leftDisabled = pageDirection === 'ltr' ? !canGoPrevious : !canGoNext;
  const rightDisabled = pageDirection === 'ltr' ? !canGoNext : !canGoPrevious;

  const handleViewportKeyUp = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Shift' || event.key.startsWith('Arrow')) onKeyUp?.();
  };

  return (
    <section className="book-reader" aria-label={`Reading ${title}`}>
      <header className="book-running-header">
        <span className="book-running-title">{title}</span>
        <span>{pageDirection === 'ltr' ? 'Left to right' : 'Right to left'}</span>
      </header>

      <div className="book-stage">
        <button
          type="button"
          className="book-page-edge book-page-edge-left"
          aria-label={pageDirection === 'ltr' ? 'Previous pages' : 'Next pages'}
          disabled={leftDisabled}
          onClick={leftAction}
        >
          <ChevronLeft size={28} strokeWidth={1.5} />
        </button>

        <div
          ref={viewportRef}
          className="book-viewport"
          data-pages-per-spread={layout.pagesPerSpread}
          data-page-direction={pageDirection}
          tabIndex={0}
          onKeyUp={handleViewportKeyUp}
        >
          <article
            ref={readerRef}
            className={`reader book-flow ${showImages ? '' : 'images-hidden'}`}
            style={readerStyle}
            onLoadCapture={() => setContentRevision((revision) => revision + 1)}
            onMouseUp={onMouseUp}
          >
            {toolbar}
            <div className="reader-content" dir={textDirection} dangerouslySetInnerHTML={{ __html: html }} />
          </article>
          <span className="book-gutter" aria-hidden="true" />
        </div>

        <button
          type="button"
          className="book-page-edge book-page-edge-right"
          aria-label={pageDirection === 'ltr' ? 'Next pages' : 'Previous pages'}
          disabled={rightDisabled}
          onClick={rightAction}
        >
          <ChevronRight size={28} strokeWidth={1.5} />
        </button>
      </div>

      <footer className="book-navigator">
        <button
          type="button"
          className="book-nav-action"
          onClick={goPrevious}
          disabled={!canGoPrevious}
          aria-label="Previous spread"
        >
          <ArrowLeft size={18} strokeWidth={1.5} />
        </button>
        <label className="book-progress-control">
          <span>{pageLabel}</span>
          <input
            type="range"
            min={0}
            max={Math.max(0, pageCount - 1)}
            step={layout.pagesPerSpread}
            value={Math.min(currentPage, Math.max(0, pageCount - 1))}
            aria-label="Reading page"
            onChange={(event) => setLogicalPage(Number(event.currentTarget.value))}
          />
        </label>
        {onAddBookmark ? (
          <button type="button" className="book-nav-action" onClick={onAddBookmark} aria-label="Bookmark current page">
            <Bookmark size={18} strokeWidth={1.5} />
          </button>
        ) : null}
        <button
          type="button"
          className="book-nav-action"
          onClick={goNext}
          disabled={!canGoNext}
          aria-label="Next spread"
        >
          <ArrowRight size={18} strokeWidth={1.5} />
        </button>
      </footer>
    </section>
  );
});
