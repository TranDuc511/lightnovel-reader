import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { createLibraryId } from '../lib/library';
import { saveReadingProgress } from '../lib/readingProgress';

function selectText(node: HTMLElement, startOffset: number, endOffset: number) {
  const textNode = node.firstChild;
  if (!textNode) throw new Error('Missing text node to select.');

  const selection = window.getSelection();
  if (!selection) throw new Error('Missing window selection.');

  const range = document.createRange();
  range.setStart(textNode, startOffset);
  range.setEnd(textNode, endOffset);
  selection.removeAllRanges();
  selection.addRange(range);
}

describe('App reading progress', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 2000 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });
    Object.defineProperty(window, 'scrollY', { configurable: true, writable: true, value: 0 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resumes saved reading progress when the same story is opened again', async () => {
    const user = userEvent.setup();
    const rawText = 'Line one\n\nLine two';
    const storyId = createLibraryId({ title: 'resume-me', kind: 'text', rawText });
    saveReadingProgress(storyId, 0.456, window.localStorage, () => new Date('2026-06-20T12:00:00.000Z'));

    render(<App />);

    await user.upload(screen.getByLabelText(/choose file/i), new File([rawText], 'resume-me.txt', { type: 'text/plain' }));

    await waitFor(() => {
      expect(screen.getByText(/Opened resume-me \(text\)\. Resumed at 46%\. Saved to library\./)).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Reading progress')).toHaveTextContent('Progress 46%');
    expect(window.scrollTo).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /library/i }));

    expect(screen.getAllByText('Progress 46%').length).toBeGreaterThan(0);
  });

  it('opens bookmark hub and lets user manage multiple bookmarks', async () => {
    const user = userEvent.setup();
    const rawText = 'Line one\n\nLine two\n\nLine three';

    render(<App />);

    await user.upload(screen.getByLabelText(/choose file/i), new File([rawText], 'bookmark-me.txt', { type: 'text/plain' }));

    await waitFor(() => {
      expect(screen.getByText(/Opened bookmark-me \(text\)\. Saved to library\./)).toBeInTheDocument();
    });

    window.scrollY = 250;
    await user.click(screen.getByRole('button', { name: /open bookmark hub/i }));

    const hub = screen.getByRole('dialog', { name: /bookmark hub/i });
    expect(within(hub).getByText('No bookmarks yet.')).toBeInTheDocument();

    await user.click(within(hub).getByRole('button', { name: /add current spot/i }));

    expect(within(hub).getByRole('button', { name: /jump to bookmark 25%/i })).toBeInTheDocument();
    expect(within(hub).getByText('1 saved')).toBeInTheDocument();

    window.scrollY = 750;
    await user.click(within(hub).getByRole('button', { name: /add current spot/i }));

    expect(within(hub).getByRole('button', { name: /jump to bookmark 75%/i })).toBeInTheDocument();
    expect(within(hub).getByRole('button', { name: /jump to bookmark 25%/i })).toBeInTheDocument();
    expect(within(hub).getByText('2 saved')).toBeInTheDocument();

    await user.click(within(hub).getByRole('button', { name: /jump to bookmark 25%/i }));

    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 250, behavior: 'smooth' });

    await user.click(within(hub).getByRole('button', { name: /remove bookmark 75%/i }));

    expect(within(hub).queryByRole('button', { name: /jump to bookmark 75%/i })).not.toBeInTheDocument();
    expect(within(hub).getByText('1 saved')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /library/i }));

    expect(screen.getByText('Bookmarks 1')).toBeInTheDocument();
  });

  it('saves selected text as highlight and shows it in hub and library', async () => {
    const user = userEvent.setup();
    const rawText = 'Alpha beta gamma delta epsilon';

    render(<App />);

    await user.upload(screen.getByLabelText(/choose file/i), new File([rawText], 'highlight-me.txt', { type: 'text/plain' }));

    await waitFor(() => {
      expect(screen.getByText(/Opened highlight-me \(text\)\. Saved to library\./)).toBeInTheDocument();
    });

    const paragraph = screen.getByText('Alpha beta gamma delta epsilon');
    selectText(paragraph, 6, 16);
    fireEvent.mouseUp(paragraph);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /highlight selection/i })).toBeInTheDocument();
    });

    const inlineAction = screen.getByRole('button', { name: /highlight selection/i });
    expect(inlineAction.closest('.reader-selection-toolbar')).not.toBeNull();

    await user.click(inlineAction);

    expect(document.querySelector('mark.reader-highlight')).not.toBeNull();

    const hub = await screen.findByRole('dialog', { name: /highlight hub/i });
    expect(within(hub).getByText('1 saved')).toBeInTheDocument();
    expect(within(hub).getByText('beta gamma')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /library/i }));

    expect(screen.getByText('Highlights 1')).toBeInTheDocument();
  });
});
