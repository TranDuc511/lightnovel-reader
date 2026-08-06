import { describe, expect, it } from 'vitest';
import { createPageFlipPlan } from '../lib/pageFlip';

describe('page flip planning', () => {
  it('maps a left-to-right forward spread onto a right page leaf', () => {
    expect(createPageFlipPlan({
      fromPage: 0,
      targetPage: 2,
      pageDirection: 'ltr',
      motion: 'turn'
    })).toMatchObject({
      sourceSide: 'right',
      destinationSide: 'left'
    });
  });

  it('mirrors the physical page leaf for right-to-left reading', () => {
    expect(createPageFlipPlan({
      fromPage: 0,
      targetPage: 2,
      pageDirection: 'rtl',
      motion: 'turn'
    })).toMatchObject({
      sourceSide: 'left',
      destinationSide: 'right'
    });
  });

  it('uses the opposite leaf when returning to an earlier spread', () => {
    expect(createPageFlipPlan({
      fromPage: 2,
      targetPage: 0,
      pageDirection: 'ltr',
      motion: 'turn'
    })).toMatchObject({
      sourceSide: 'left',
      destinationSide: 'right'
    });
  });
});
