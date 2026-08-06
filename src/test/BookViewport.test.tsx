import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookViewport } from '../components/BookViewport';

const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
const originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
const originalScrollWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth');
const originalResizeObserver = globalThis.ResizeObserver;
const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');

describe('BookViewport pagination', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return this.classList.contains('book-viewport') ? 1200 : 0;
      }
    });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get() {
        return this.classList.contains('book-viewport') ? 760 : 0;
      }
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get() {
        return this.classList.contains('book-flow') ? 3000 : 0;
      }
    });

    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as typeof ResizeObserver;

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreDescriptor('clientWidth', originalClientWidth);
    restoreDescriptor('clientHeight', originalClientHeight);
    restoreDescriptor('scrollWidth', originalScrollWidth);
    globalThis.ResizeObserver = originalResizeObserver;
    restoreWindowDescriptor('matchMedia', originalMatchMedia);
  });

  it('restores the saved page only after pagination is measured', async () => {
    const onProgressChange = vi.fn();

    render(
      <BookViewport
        contentKey="saved-book"
        title="Saved book"
        html="<h1>Saved book</h1><p>Long story content.</p>"
        initialProgress={0.5}
        fontSize={19}
        lineHeight={1.75}
        contentWidth={72}
        showImages
        pageDirection="ltr"
        textDirection="auto"
        spreadMode="auto"
        onProgressChange={onProgressChange}
      />
    );

    expect(await screen.findByText('Pages 3-4 of 5')).toBeInTheDocument();
    await waitFor(() => expect(onProgressChange).toHaveBeenLastCalledWith(0.5));
    expect(onProgressChange).not.toHaveBeenCalledWith(0);
  });

  it('reverses the physical next-page edge in right-to-left mode', async () => {
    const user = userEvent.setup();

    render(
      <BookViewport
        contentKey="rtl-book"
        title="RTL book"
        html="<h1>RTL book</h1><p>Long story content.</p>"
        initialProgress={0}
        fontSize={19}
        lineHeight={1.75}
        contentWidth={72}
        showImages
        pageDirection="rtl"
        textDirection="auto"
        spreadMode="auto"
        onProgressChange={() => undefined}
      />
    );

    const nextEdge = await screen.findByRole('button', { name: 'Next pages' });
    expect(nextEdge).toHaveClass('book-page-edge-left');

    await user.click(nextEdge);

    const flipLayer = document.querySelector('.book-page-flip-layer');
    expect(flipLayer).toHaveAttribute('data-source-side', 'left');
    const pageLeaf = document.querySelector('.book-page-leaf');
    expect(pageLeaf).not.toBeNull();
    fireEvent.animationEnd(pageLeaf as Element);

    expect(await screen.findByText('Pages 3-4 of 5')).toBeInTheDocument();
  });

  it('commits progress only after the physical page leaf finishes turning', async () => {
    const user = userEvent.setup();
    const onProgressChange = vi.fn();

    render(
      <BookViewport
        contentKey="animated-book"
        title="Animated book"
        html='<h1 id="chapter-title">Animated book</h1><p>Long story content.</p>'
        initialProgress={0}
        fontSize={19}
        lineHeight={1.75}
        contentWidth={72}
        showImages
        pageDirection="ltr"
        textDirection="auto"
        spreadMode="auto"
        onProgressChange={onProgressChange}
      />
    );

    expect(await screen.findByText('Pages 1-2 of 5')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next pages' }));

    expect(screen.getByText('Pages 1-2 of 5')).toBeInTheDocument();
    expect(onProgressChange).not.toHaveBeenCalledWith(0.5);

    const flipLayer = document.querySelector('.book-page-flip-layer');
    expect(flipLayer).toHaveAttribute('data-source-side', 'right');
    expect(flipLayer?.querySelectorAll('.reader')).toHaveLength(0);
    expect(flipLayer?.querySelectorAll('#chapter-title')).toHaveLength(0);

    const pageLeaf = document.querySelector('.book-page-leaf');
    expect(pageLeaf).not.toBeNull();
    fireEvent.animationEnd(pageLeaf as Element);

    expect(await screen.findByText('Pages 3-4 of 5')).toBeInTheDocument();
    await waitFor(() => expect(onProgressChange).toHaveBeenLastCalledWith(0.5));
  });

  it('does not repaginate the full document after every page turn', async () => {
    const user = userEvent.setup();
    let paginationReads = 0;
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get() {
        if (this.classList.contains('book-flow')) {
          paginationReads += 1;
          return 3000;
        }
        return 0;
      }
    });

    render(
      <BookViewport
        contentKey="pagination-performance-book"
        title="Pagination performance book"
        html="<h1>Pagination performance book</h1><p>Long story content.</p>"
        initialProgress={0}
        fontSize={19}
        lineHeight={1.75}
        contentWidth={72}
        showImages
        pageDirection="ltr"
        textDirection="auto"
        spreadMode="auto"
        onProgressChange={() => undefined}
      />
    );

    await screen.findByText('Pages 1-2 of 5');
    paginationReads = 0;
    await user.click(screen.getByRole('button', { name: 'Next pages' }));
    fireEvent.animationEnd(document.querySelector('.book-page-leaf') as Element);
    await screen.findByText('Pages 3-4 of 5');

    expect(paginationReads).toBe(0);
  });

  it('queues rapid page turns and finishes at the latest requested spread', async () => {
    const user = userEvent.setup();

    render(
      <BookViewport
        contentKey="queued-book"
        title="Queued book"
        html="<h1>Queued book</h1><p>Long story content.</p>"
        initialProgress={0}
        fontSize={19}
        lineHeight={1.75}
        contentWidth={72}
        showImages
        pageDirection="ltr"
        textDirection="auto"
        spreadMode="auto"
        onProgressChange={() => undefined}
      />
    );

    await screen.findByText('Pages 1-2 of 5');
    await user.click(screen.getByRole('button', { name: 'Next pages' }));
    await user.click(screen.getByRole('button', { name: 'Next pages' }));

    const firstLeaf = document.querySelector('.book-page-leaf');
    expect(firstLeaf).not.toBeNull();
    fireEvent.animationEnd(firstLeaf as Element);

    await waitFor(() => {
      const nextLeaf = document.querySelector('.book-page-leaf');
      expect(nextLeaf).not.toBeNull();
      expect(nextLeaf).not.toBe(firstLeaf);
    });

    fireEvent.animationEnd(document.querySelector('.book-page-leaf') as Element);
    expect(await screen.findByText('Page 5 of 5')).toBeInTheDocument();
  });

  it('ignores pointer gestures and starts page turns from navigation buttons', async () => {
    const user = userEvent.setup();
    render(
      <BookViewport
        contentKey="button-only-book"
        title="Button only book"
        html="<h1>Button only book</h1><p>Long story content.</p>"
        initialProgress={0}
        fontSize={19}
        lineHeight={1.75}
        contentWidth={72}
        showImages
        pageDirection="ltr"
        textDirection="auto"
        spreadMode="auto"
        onProgressChange={() => undefined}
      />
    );

    await screen.findByText('Pages 1-2 of 5');
    const viewport = document.querySelector('.book-viewport');
    expect(viewport).not.toBeNull();

    fireEvent.pointerDown(viewport as Element, { pointerId: 7, button: 0, clientX: 1180 });
    fireEvent.pointerMove(viewport as Element, { pointerId: 7, clientX: 820 });

    expect(document.querySelector('.book-page-flip-layer')).toBeNull();
    expect(screen.getByText('Pages 1-2 of 5')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next pages' }));
    expect(document.querySelector('.book-page-flip-layer')).toHaveAttribute('data-phase', 'turning');
  });

  it('changes pages immediately when reduced motion is requested', async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn()
      })
    });
    const user = userEvent.setup();

    render(
      <BookViewport
        contentKey="reduced-motion-book"
        title="Reduced motion book"
        html="<h1>Reduced motion book</h1><p>Long story content.</p>"
        initialProgress={0}
        fontSize={19}
        lineHeight={1.75}
        contentWidth={72}
        showImages
        pageDirection="ltr"
        textDirection="auto"
        spreadMode="auto"
        onProgressChange={() => undefined}
      />
    );

    await screen.findByText('Pages 1-2 of 5');
    await user.click(screen.getByRole('button', { name: 'Next pages' }));

    expect(await screen.findByText('Pages 3-4 of 5')).toBeInTheDocument();
    expect(document.querySelector('.book-page-flip-layer')).toBeNull();
  });
});

function restoreDescriptor(
  key: 'clientWidth' | 'clientHeight' | 'scrollWidth',
  descriptor: PropertyDescriptor | undefined
) {
  if (descriptor) Object.defineProperty(HTMLElement.prototype, key, descriptor);
  else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[key];
}

function restoreWindowDescriptor(key: 'matchMedia', descriptor: PropertyDescriptor | undefined) {
  if (descriptor) Object.defineProperty(window, key, descriptor);
  else delete (window as unknown as Record<string, unknown>)[key];
}
