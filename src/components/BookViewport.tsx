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
import { PageFlipLayer, type PageFlipLayout as BookLayout } from './PageFlipLayer';
import {
  createPageFlipPlan,
  type PageFlipMotion,
  type PageFlipPlan
} from '../lib/pageFlip';
import type { PageDirection, SpreadMode, TextDirection } from '../lib/preferences';

type NavigationMode = PageFlipMotion | 'instant';

type PageFlipState = {
  plan: PageFlipPlan;
  phase: 'preparing' | 'turning';
  progress: number;
};

type QueuedNavigation = {
  page: number;
  motion: PageFlipMotion;
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
  const measuredImageSourcesRef = useRef(new Set<string>());
  const [layout, setLayout] = useState<BookLayout>(emptyLayout);
  const [pageCount, setPageCount] = useState(1);
  const [currentPage, setCurrentPage] = useState(0);
  const [visualPage, setVisualPage] = useState(0);
  const [contentRevision, setContentRevision] = useState(0);
  const [isPaginationReady, setIsPaginationReady] = useState(false);
  const [pageFlip, setPageFlip] = useState<PageFlipState | null>(null);
  const [queuedNavigation, setQueuedNavigation] = useState<QueuedNavigation | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const lastSpreadStart = Math.max(
    0,
    Math.floor((pageCount - 1) / layout.pagesPerSpread) * layout.pagesPerSpread
  );

  const normalizePage = useCallback(
    (page: number) => {
      return Math.floor(Math.max(0, Math.min(lastSpreadStart, page)) / layout.pagesPerSpread)
        * layout.pagesPerSpread;
    },
    [lastSpreadStart, layout.pagesPerSpread]
  );

  const commitPage = useCallback((page: number) => {
    setVisualPage(page);
    setCurrentPage(page);
  }, []);

  const navigateToPage = useCallback(
    (page: number, mode: NavigationMode) => {
      const targetPage = normalizePage(page);

      if (
        mode === 'instant'
        || prefersReducedMotion
        || !isPaginationReady
        || layout.pageStep <= 0
      ) {
        pendingProgressRef.current = pageCount <= 1 ? 0 : targetPage / (pageCount - 1);
        setQueuedNavigation(null);
        setPageFlip(null);
        commitPage(targetPage);
        return;
      }

      if (pageFlip) {
        setQueuedNavigation(
          targetPage === pageFlip.plan.targetPage
            ? null
            : { page: targetPage, motion: mode }
        );
        return;
      }

      if (targetPage === currentPage) return;

      pendingProgressRef.current = pageCount <= 1 ? 0 : targetPage / (pageCount - 1);
      setVisualPage(targetPage);
      setPageFlip({
        phase: 'preparing',
        progress: 0,
        plan: createPageFlipPlan({
          fromPage: currentPage,
          targetPage,
          pageDirection,
          motion: mode
        })
      });
    },
    [
      commitPage,
      currentPage,
      isPaginationReady,
      layout.pageStep,
      layout.pagesPerSpread,
      normalizePage,
      pageCount,
      pageDirection,
      pageFlip,
      prefersReducedMotion
    ]
  );

  const navigationPage = queuedNavigation?.page ?? pageFlip?.plan.targetPage ?? currentPage;
  const canGoPrevious = navigationPage > 0;
  const canGoNext = navigationPage < lastSpreadStart;

  const goPrevious = useCallback(() => {
    navigateToPage(navigationPage - layout.pagesPerSpread, 'turn');
  }, [layout.pagesPerSpread, navigateToPage, navigationPage]);

  const goNext = useCallback(() => {
    navigateToPage(navigationPage + layout.pagesPerSpread, 'turn');
  }, [layout.pagesPerSpread, navigateToPage, navigationPage]);

  const getProgress = useCallback(() => {
    if (pageCount <= 1) return 0;
    return Math.min(1, currentPage / (pageCount - 1));
  }, [currentPage, pageCount]);

  const goToProgress = useCallback(
    (ratio: number) => {
      const normalized = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0));
      navigateToPage(Math.round(normalized * Math.max(0, pageCount - 1)), 'jump');
    },
    [navigateToPage, pageCount]
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
      navigateToPage(getElementPage(element), 'jump');
      return true;
    },
    [getElementPage, navigateToPage]
  );

  const finishPageFlip = useCallback(() => {
    if (!pageFlip) return;
    commitPage(pageFlip.plan.targetPage);
    setPageFlip(null);
  }, [commitPage, pageFlip]);

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

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;

    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(query.matches);
    updatePreference();
    query.addEventListener?.('change', updatePreference);
    return () => query.removeEventListener?.('change', updatePreference);
  }, []);

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
    measuredImageSourcesRef.current.clear();
    setCurrentPage(0);
    setVisualPage(0);
    setPageCount(1);
    setIsPaginationReady(false);
    setPageFlip(null);
    setQueuedNavigation(null);
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
      const targetSpread = Math.floor(targetPage / layout.pagesPerSpread) * layout.pagesPerSpread;

      setPageCount(nextPageCount);
      setCurrentPage(targetSpread);
      setVisualPage(targetSpread);
      setPageFlip(null);
      setQueuedNavigation(null);
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
    if (pageFlip?.phase !== 'preparing') return;

    const frameId = window.requestAnimationFrame(() => {
      setPageFlip((current) => current?.plan === pageFlip.plan
        ? { ...current, phase: 'turning', progress: 1 }
        : current);
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [pageFlip]);

  useEffect(() => {
    if (pageFlip?.phase !== 'turning') return;

    const timeoutId = window.setTimeout(
      finishPageFlip,
      pageFlip.plan.motion === 'turn' ? 720 : 480
    );
    return () => window.clearTimeout(timeoutId);
  }, [finishPageFlip, pageFlip]);

  useEffect(() => {
    if (!prefersReducedMotion || !pageFlip) return;
    finishPageFlip();
  }, [finishPageFlip, pageFlip, prefersReducedMotion]);

  useEffect(() => {
    if (pageFlip || !queuedNavigation) return;

    const nextNavigation = queuedNavigation;
    setQueuedNavigation(null);
    const frameId = window.requestAnimationFrame(() => {
      navigateToPage(nextNavigation.page, nextNavigation.motion);
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [navigateToPage, pageFlip, queuedNavigation]);

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
        navigateToPage(0, 'jump');
      } else if (event.key === 'End') {
        event.preventDefault();
        navigateToPage(lastSpreadStart, 'jump');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrevious, lastSpreadStart, navigateToPage, pageDirection]);

  const transform = `${pageDirection === 'rtl' ? '' : '-'}${visualPage * layout.pageStep}px`;
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

        <div className="book-object">
          <span className="book-ambient-shadow" aria-hidden="true" />
          <span className="book-cover-board" aria-hidden="true" />
          <span className="book-page-block" aria-hidden="true" />
          <div
            ref={viewportRef}
            className="book-viewport"
          data-pages-per-spread={layout.pagesPerSpread}
          data-page-direction={pageDirection}
          aria-busy={pageFlip ? 'true' : undefined}
          tabIndex={0}
          onKeyUp={handleViewportKeyUp}
          >
          <article
            ref={readerRef}
            className={`reader book-flow ${showImages ? '' : 'images-hidden'}`}
            style={readerStyle}
            onLoadCapture={(event) => {
              const image = event.target;
              if (!(image instanceof HTMLImageElement)) return;

              const source = image.currentSrc || image.src;
              if (measuredImageSourcesRef.current.has(source)) return;
              measuredImageSourcesRef.current.add(source);
              setContentRevision((revision) => revision + 1);
            }}
            onMouseUp={onMouseUp}
          >
            {toolbar}
            <div className="reader-content" dir={textDirection} dangerouslySetInnerHTML={{ __html: html }} />
          </article>
          <span className="book-gutter" aria-hidden="true" />
          {pageFlip ? (
            <PageFlipLayer
              plan={pageFlip.plan}
              phase={pageFlip.phase}
              progress={pageFlip.progress}
              layout={layout}
              onAnimationEnd={finishPageFlip}
            />
          ) : null}
          </div>
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
            onChange={(event) => navigateToPage(Number(event.currentTarget.value), 'instant')}
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
