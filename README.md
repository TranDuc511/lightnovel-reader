# Light Novel Reader

A browser-based light novel reader for local Markdown (`.md`), text (`.txt`), and PDF (`.pdf`) files.

## Demo

![Light Novel Reader demo](docs/demo.png)

## MVP Features

- Drag and drop or choose a file from your device.
- Safely render Markdown as HTML.
- Read TXT files while preserving paragraph line breaks.
- Extract PDF text with `pdfjs-dist`.
- Customize light/dark/sepia themes, font size, line height, and content width.
- No uploads; files are processed in the browser.

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
  lib/preferences.ts
  test/*.test.ts
```
