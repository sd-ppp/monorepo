import type { SelectionRect } from '../types';

export const MIN_SELECTION_EDGE = 4;

export const roundRect = (rect: SelectionRect): SelectionRect => ({
  x: Math.round(rect.x),
  y: Math.round(rect.y),
  width: Math.round(rect.width),
  height: Math.round(rect.height),
});
