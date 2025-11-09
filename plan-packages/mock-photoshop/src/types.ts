export type ShapeKind = 'rect' | 'triangle' | 'circle' | 'star';

export interface ShapeDefinition {
  id: string;
  kind: ShapeKind;
  x: number;
  y: number;
  size: number;
  rotation: number;
  fill: string;
  stroke: string;
  opacity: number;
}

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
