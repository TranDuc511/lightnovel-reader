import { describe, expect, it, vi } from 'vitest';
import { createGoogleDriveDownloadUrl, extractGoogleDriveFileId, importGoogleDriveFile } from '../lib/googleDrive';

describe('Google Drive import helpers', () => {
  it('extracts file ids from common Google Drive share links', () => {
    expect(extractGoogleDriveFileId('https://drive.google.com/file/d/abc123XYZ/view?usp=sharing')).toBe(
      'abc123XYZ'
    );
    expect(extractGoogleDriveFileId('https://drive.google.com/open?id=drive-id-42')).toBe('drive-id-42');
    expect(extractGoogleDriveFileId('https://drive.google.com/uc?export=download&id=epub-file')).toBe('epub-file');
    expect(extractGoogleDriveFileId('https://example.com/not-drive')).toBeNull();
  });

  it('builds a direct Google Drive download URL from a file id', () => {
    expect(createGoogleDriveDownloadUrl('abc123XYZ')).toBe(
      'https://drive.google.com/uc?export=download&id=abc123XYZ'
    );
  });

  it('imports a Drive file response as a File with a name from content-disposition', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response('# Drive Novel', {
        headers: {
          'content-disposition': 'attachment; filename="drive-novel.md"',
          'content-type': 'text/markdown'
        }
      })
    );

    const file = await importGoogleDriveFile('https://drive.google.com/file/d/abc123XYZ/view', fetcher);

    expect(fetcher).toHaveBeenCalledWith('https://drive.google.com/uc?export=download&id=abc123XYZ');
    expect(file.name).toBe('drive-novel.md');
    expect(file.type).toBe('text/markdown');
    expect(await file.text()).toBe('# Drive Novel');
  });
});
