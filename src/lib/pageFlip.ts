import type { PageDirection } from './preferences';

export type PhysicalPageSide = 'left' | 'right';
export type PageFlipMotion = 'turn' | 'jump';

export type PageFlipPlan = {
  fromPage: number;
  targetPage: number;
  sourceSide: PhysicalPageSide;
  destinationSide: PhysicalPageSide;
  motion: PageFlipMotion;
};

type CreatePageFlipPlanOptions = {
  fromPage: number;
  targetPage: number;
  pageDirection: PageDirection;
  motion: PageFlipMotion;
};

export function createPageFlipPlan({
  fromPage,
  targetPage,
  pageDirection,
  motion
}: CreatePageFlipPlanOptions): PageFlipPlan {
  const isForward = targetPage > fromPage;
  const sourceSide: PhysicalPageSide = isForward
    ? pageDirection === 'ltr' ? 'right' : 'left'
    : pageDirection === 'ltr' ? 'left' : 'right';
  const destinationSide = oppositeSide(sourceSide);

  return {
    fromPage,
    targetPage,
    sourceSide,
    destinationSide,
    motion
  };
}

function oppositeSide(side: PhysicalPageSide): PhysicalPageSide {
  return side === 'left' ? 'right' : 'left';
}
