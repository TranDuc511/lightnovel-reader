import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { createLibraryId } from '../lib/library';
import { saveReadingProgress } from '../lib/readingProgress';

describe('App reading progress', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
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
});
