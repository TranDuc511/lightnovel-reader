import {
  type CSSProperties,
  type SyntheticEvent
} from 'react';
import type { PageFlipPlan } from '../lib/pageFlip';

export type PageFlipLayout = {
  viewportWidth: number;
  viewportHeight: number;
  pagesPerSpread: number;
  pageWidth: number;
  columnGap: number;
  pageStep: number;
  paddingX: number;
  paddingY: number;
};

type PageFlipLayerProps = {
  plan: PageFlipPlan;
  phase: 'preparing' | 'turning';
  progress: number;
  layout: PageFlipLayout;
  onAnimationEnd: () => void;
};

export function PageFlipLayer({
  plan,
  phase,
  progress,
  layout,
  onAnimationEnd
}: PageFlipLayerProps) {
  const layerStyle = {
    '--book-flip-surface-width': `${layout.viewportWidth / layout.pagesPerSpread}px`,
    '--book-flip-progress': String(progress)
  } as CSSProperties;

  const handleAnimationEnd = (event: SyntheticEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onAnimationEnd();
  };

  return (
    <div
      className="book-page-flip-layer"
      data-phase={phase}
      data-motion={plan.motion}
      data-pages-per-spread={layout.pagesPerSpread}
      data-source-side={plan.sourceSide}
      style={layerStyle}
      aria-hidden="true"
      inert
    >
      <span className="book-page-cast-shadow" />
      <div
        className="book-page-leaf"
        onAnimationEnd={handleAnimationEnd}
        onTransitionEnd={handleAnimationEnd}
      >
        <div className="book-page-face book-page-face-front">
          <span className="book-page-paper-light" />
          <span className="book-page-paper-fibre" />
          <span className="book-page-face-shade" />
          <span className="book-page-curl" />
        </div>
        <div className="book-page-face book-page-face-back">
          <span className="book-page-paper-light" />
          <span className="book-page-paper-fibre" />
          <span className="book-page-face-shade" />
          <span className="book-page-curl" />
        </div>
      </div>
    </div>
  );
}
