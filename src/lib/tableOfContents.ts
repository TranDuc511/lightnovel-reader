import type { FileKind } from './fileReaders';

export type TableOfContentsEntry = {
  id: string;
  label: string;
  level: number;
};

export type TableOfContentsResult = {
  html: string;
  entries: TableOfContentsEntry[];
};

const FALLBACK_LABELS = ['Start', 'About one quarter in', 'About halfway through', 'Near the end'];

export function createTableOfContents(html: string, kind: Exclude<FileKind, 'unsupported'>): TableOfContentsResult {
  const document = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const body = document.body;
  const epubChapters = kind === 'epub'
    ? Array.from(body.querySelectorAll<HTMLElement>('section[data-epub-chapter]'))
    : [];

  if (epubChapters.length > 0) {
    return createEntries(body, epubChapters, (chapter, index) => ({
      label: chapter.dataset.epubChapter?.trim() || `Chapter ${index + 1}`,
      level: 1
    }));
  }

  const headings = Array.from(body.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6'))
    .filter((heading) => Boolean(heading.textContent?.trim()));

  if (headings.length > 0) {
    return createEntries(body, headings, (heading) => ({
      label: heading.textContent?.trim() ?? 'Untitled section',
      level: Number(heading.tagName.slice(1))
    }));
  }

  const contentBlocks = Array.from(body.querySelectorAll<HTMLElement>('p, blockquote, pre, li'))
    .filter((block) => Boolean(block.textContent?.trim()));
  const targets = selectLandmarks(contentBlocks.length > 0 ? contentBlocks : [body]);

  return createEntries(body, targets, (_target, index) => ({
    label: FALLBACK_LABELS[index] ?? `Part ${index + 1}`,
    level: 1
  }));
}

function createEntries(
  body: HTMLElement,
  targets: HTMLElement[],
  describe: (target: HTMLElement, index: number) => Pick<TableOfContentsEntry, 'label' | 'level'>
): TableOfContentsResult {
  const entries = targets.map((target, index) => {
    const id = `toc-entry-${index + 1}`;
    const { label, level } = describe(target, index);
    target.dataset.tocId = id;
    return { id, label, level };
  });

  return { html: body.innerHTML, entries };
}

function selectLandmarks(blocks: HTMLElement[]): HTMLElement[] {
  const count = Math.min(FALLBACK_LABELS.length, blocks.length);
  if (count === 1) return [blocks[0]];

  return Array.from({ length: count }, (_, index) => {
    const position = Math.round((index * (blocks.length - 1)) / (count - 1));
    return blocks[position];
  });
}
