export type ContentType = 'canvas' | 'curlayer' | 'selection';
export type TrackType = 'image' | 'mask';

type UxpUriBrand<TName extends string> = string & { __uxpUriBrand: TName };

export type BoundaryUri = UxpUriBrand<'boundary'>;
export type ContentUri = UxpUriBrand<'content'>;
export type MaskUri = UxpUriBrand<'mask'>;

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
