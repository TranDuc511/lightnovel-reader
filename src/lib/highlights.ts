export type HighlightAnchor = {
  quote: string;
  prefix: string;
  suffix: string;
};

export type TextHighlight = HighlightAnchor & {
  highlightId: string;
  storyId: string;
  createdAt: string;
};

const READING_HIGHLIGHT_STORAGE_KEY = 'lightnovel-reader.highlights.v1';

type HighlightMap = Record<string, TextHighlight[]>;

export function createHighlightAnchor(
  fullText: string,
  start: number,
  end: number,
  contextLength = 32
): HighlightAnchor {
  const safeStart = clampOffset(start, fullText.length);
  const safeEnd = clampOffset(end, fullText.length);
  const rangeStart = Math.min(safeStart, safeEnd);
  const rangeEnd = Math.max(safeStart, safeEnd);
  const quote = fullText.slice(rangeStart, rangeEnd).trim();

  if (!quote) {
    throw new Error('Cannot highlight empty text.');
  }

  return {
    quote,
    prefix: fullText.slice(Math.max(0, rangeStart - contextLength), rangeStart),
    suffix: fullText.slice(rangeEnd, Math.min(fullText.length, rangeEnd + contextLength))
  };
}

export function createHighlightAnchorFromSelection(
  root: HTMLElement,
  selection: Selection | null,
  contextLength = 32
): HighlightAnchor | null {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

  const range = selection.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return null;
  if (range.startContainer !== range.endContainer || range.startContainer.nodeType !== Node.TEXT_NODE) return null;

  const textNode = range.startContainer as Text;
  return createHighlightAnchor(textNode.data, range.startOffset, range.endOffset, contextLength);
}

export function loadHighlights(storyId: string, storage: Storage = window.localStorage): TextHighlight[] {
  return readHighlightMap(storage)[storyId] ?? [];
}

export function saveHighlight(
  storyId: string,
  anchor: HighlightAnchor,
  storage: Storage = window.localStorage,
  now: () => Date = () => new Date(),
  createId: () => string = defaultCreateHighlightId
): TextHighlight {
  const highlightMap = readHighlightMap(storage);
  const storyHighlights = highlightMap[storyId] ?? [];
  const existing = storyHighlights.find((highlight) => isSameAnchor(highlight, anchor));
  if (existing) return existing;

  const highlight: TextHighlight = {
    highlightId: createId(),
    storyId,
    quote: anchor.quote.trim(),
    prefix: anchor.prefix,
    suffix: anchor.suffix,
    createdAt: now().toISOString()
  };
  const nextHighlights = sortHighlights([highlight, ...storyHighlights]);

  storage.setItem(READING_HIGHLIGHT_STORAGE_KEY, JSON.stringify({ ...highlightMap, [storyId]: nextHighlights }));
  return highlight;
}

export function removeHighlight(storyId: string, highlightId: string, storage: Storage = window.localStorage): void {
  const highlightMap = readHighlightMap(storage);
  const nextHighlights = (highlightMap[storyId] ?? []).filter((highlight) => highlight.highlightId !== highlightId);

  if (nextHighlights.length === 0) {
    delete highlightMap[storyId];
  } else {
    highlightMap[storyId] = nextHighlights;
  }

  storage.setItem(READING_HIGHLIGHT_STORAGE_KEY, JSON.stringify(highlightMap));
}

export function removeHighlights(storyId: string, storage: Storage = window.localStorage): void {
  const highlightMap = readHighlightMap(storage);
  delete highlightMap[storyId];
  storage.setItem(READING_HIGHLIGHT_STORAGE_KEY, JSON.stringify(highlightMap));
}

export function renderHighlightsOnHtml(html: string, highlights: TextHighlight[]): string {
  if (highlights.length === 0) return html;

  const document = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const body = document.body;
  let changed = false;

  for (const highlight of highlights) {
    const match = findHighlightTarget(body, highlight);
    if (!match) continue;

    wrapMatch(document, match.node, match.startOffset, match.endOffset, highlight.highlightId);
    changed = true;
  }

  return changed ? body.innerHTML : html;
}

function readHighlightMap(storage: Storage): HighlightMap {
  const raw = storage.getItem(READING_HIGHLIGHT_STORAGE_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed)
        .map(([storyId, value]) => [storyId, normalizeHighlights(storyId, value)] as const)
        .filter((entry): entry is [string, TextHighlight[]] => entry[1].length > 0)
    );
  } catch {
    return {};
  }
}

function normalizeHighlights(storyId: string, value: unknown): TextHighlight[] {
  if (!Array.isArray(value)) return [];

  return sortHighlights(
    value
      .map((highlight) => sanitizeHighlight(storyId, highlight))
      .filter(isNonNullable)
  );
}

function sanitizeHighlight(storyId: string, value: unknown): TextHighlight | null {
  if (!value || typeof value !== 'object') return null;

  const highlight = value as Record<string, unknown>;
  if (
    typeof highlight.highlightId !== 'string' ||
    typeof highlight.storyId !== 'string' ||
    typeof highlight.quote !== 'string' ||
    typeof highlight.prefix !== 'string' ||
    typeof highlight.suffix !== 'string' ||
    typeof highlight.createdAt !== 'string'
  ) {
    return null;
  }

  if (highlight.storyId !== storyId || !highlight.quote.trim()) return null;

  return {
    highlightId: highlight.highlightId,
    storyId: highlight.storyId,
    quote: highlight.quote.trim(),
    prefix: highlight.prefix,
    suffix: highlight.suffix,
    createdAt: highlight.createdAt
  };
}

function sortHighlights(highlights: TextHighlight[]): TextHighlight[] {
  return [...highlights].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function isSameAnchor(left: HighlightAnchor, right: HighlightAnchor): boolean {
  return left.quote === right.quote && left.prefix === right.prefix && left.suffix === right.suffix;
}

function clampOffset(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, Math.trunc(value)));
}

function defaultCreateHighlightId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `highlight-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function findHighlightTarget(root: HTMLElement, highlight: TextHighlight): { node: Text; startOffset: number; endOffset: number } | null {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest('mark[data-highlight-id]')) return NodeFilter.FILTER_REJECT;
      return node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });

  let currentNode = walker.nextNode();
  while (currentNode) {
    const textNode = currentNode as Text;
    const matchIndex = findMatchingOffset(textNode.data, highlight);
    if (matchIndex !== null) {
      return {
        node: textNode,
        startOffset: matchIndex,
        endOffset: matchIndex + highlight.quote.length
      };
    }
    currentNode = walker.nextNode();
  }

  return null;
}

function findMatchingOffset(text: string, highlight: TextHighlight): number | null {
  let searchFrom = 0;

  while (searchFrom <= text.length) {
    const index = text.indexOf(highlight.quote, searchFrom);
    if (index === -1) return null;

    const prefixStart = Math.max(0, index - highlight.prefix.length);
    const suffixEnd = Math.min(text.length, index + highlight.quote.length + highlight.suffix.length);
    const prefix = text.slice(prefixStart, index);
    const suffix = text.slice(index + highlight.quote.length, suffixEnd);

    if (prefix === highlight.prefix && suffix === highlight.suffix) {
      return index;
    }

    searchFrom = index + highlight.quote.length;
  }

  return null;
}

function wrapMatch(document: Document, textNode: Text, startOffset: number, endOffset: number, highlightId: string): void {
  const before = textNode.data.slice(0, startOffset);
  const selected = textNode.data.slice(startOffset, endOffset);
  const after = textNode.data.slice(endOffset);
  const fragment = document.createDocumentFragment();

  if (before) fragment.appendChild(document.createTextNode(before));

  const mark = document.createElement('mark');
  mark.className = 'reader-highlight';
  mark.dataset.highlightId = highlightId;
  mark.textContent = selected;
  fragment.appendChild(mark);

  if (after) fragment.appendChild(document.createTextNode(after));

  textNode.parentNode?.replaceChild(fragment, textNode);
}

function isNonNullable<T>(value: T | null | undefined): value is T {
  return value != null;
}
