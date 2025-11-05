export type ContentType = 'canvas' | 'curlayer' | 'selection';
export type TrackType = 'image' | 'mask';

export interface BoundaryRect {
  leftDistance: number;
  topDistance: number;
  rightDistance: number;
  bottomDistance: number;
  width: number;
  height: number;
}

export type BoundarySetting = BoundaryRect | 'canvas' | 'curlayer' | 'selection' | null;

export type BoundaryResource = string | null;
