# Light Novel Reader

A browser-based light novel reader for local Markdown (`.md`), text (`.txt`), PDF (`.pdf`), and EPUB (`.epub`) files.

## Demo

![Light Novel Reader demo](docs/demo.png)

## MVP Features

- Drag and drop or choose a file from your device.
- Safely render Markdown as HTML.
- Read TXT files while preserving paragraph line breaks.
- Extract PDF text with `pdfjs-dist`.
- Read EPUB spine content and preserve embedded illustration images.
- Import public Google Drive sharing links for supported file types.
- Save opened stories to a local Library tab for quick reopening.
- Customize light/dark/sepia themes, font size, line height, and content width.
- No uploads; files are processed in the browser.

## Google Drive import

Paste a Google Drive file sharing link into the import box. The file must be shared as **Anyone with the link** and must be one of the supported formats: `.md`, `.txt`, `.pdf`, or `.epub`.

## Run locally

```bash
npm install
npm run dev
```

## Test/build

```bash
npm test
npm run build
npm run dist:win
```

The Windows portable executable is generated in `../lightnovel-reader-release/` as `LightNovelReader-<version>-portable.exe`.

## Structure

```text
src/
  components/ReaderControls.tsx
  lib/fileReaders.ts
  lib/googleDrive.ts
  lib/library.ts
  lib/preferences.ts
  test/*.test.ts
```
