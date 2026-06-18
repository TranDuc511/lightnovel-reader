import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'node:http';

const GOOGLE_DRIVE_DOWNLOAD_BASE_URL = 'https://drive.google.com/uc?export=download&id=';

async function handleGoogleDriveDownload(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const requestUrl = new URL(req.url ?? '/', 'http://localhost');
  if (requestUrl.pathname !== '/api/google-drive-download') {
    next();
    return;
  }

  const fileId = requestUrl.searchParams.get('fileId')?.trim();
  if (!fileId || !/^[A-Za-z0-9_-]+$/.test(fileId)) {
    res.statusCode = 400;
    res.end('Invalid Google Drive file id.');
    return;
  }

  try {
    const response = await fetch(`${GOOGLE_DRIVE_DOWNLOAD_BASE_URL}${encodeURIComponent(fileId)}`);
    if (!response.ok) {
      res.statusCode = response.status;
      res.end('Unable to download this Google Drive file. Make sure sharing is set to anyone with the link.');
      return;
    }

    const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
    const contentDisposition = response.headers.get('content-disposition');
    const data = Buffer.from(await response.arrayBuffer());

    res.statusCode = 200;
    res.setHeader('content-type', contentType);
    res.setHeader('cache-control', 'no-store');
    if (contentDisposition) res.setHeader('content-disposition', contentDisposition);
    res.end(data);
  } catch {
    res.statusCode = 502;
    res.end('Unable to reach Google Drive.');
  }
}

function googleDriveProxyPlugin() {
  return {
    name: 'google-drive-proxy',
    configureServer(server: { middlewares: { use: (handler: typeof handleGoogleDriveDownload) => void } }) {
      server.middlewares.use(handleGoogleDriveDownload);
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), googleDriveProxyPlugin()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts'
  }
});
