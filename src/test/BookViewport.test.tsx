import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookViewport } from '../components/BookViewport';

const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
const originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
const originalScrollWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth');
const originalResizeObserver = globalThis.ResizeObserver;

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

    expect(await screen.findByText('Pages 3-4 of 5')).toBeInTheDocument();
  });
});

function restoreDescriptor(
  key: 'clientWidth' | 'clientHeight' | 'scrollWidth',
  descriptor: PropertyDescriptor | undefined
) {
  if (descriptor) Object.defineProperty(HTMLElement.prototype, key, descriptor);
  else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[key];
}
