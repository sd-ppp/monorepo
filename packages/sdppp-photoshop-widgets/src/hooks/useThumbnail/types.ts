export interface BoundaryRect {
  leftDistance: number;
  topDistance: number;
  rightDistance: number;
  bottomDistance: number;
  width: number;
  height: number;
}

type BoundaryPrimitive = 'canvas' | 'curlayer' | 'selection';

export type BoundarySetting = BoundaryRect | BoundaryPrimitive | null;

type UxpUriBrand<TName extends string> = string & { __uxpUriBrand?: TName };

export type FileUri = UxpUriBrand<'file'>;
export type BoundaryUri = UxpUriBrand<'boundary'>;
export type ContentUri = UxpUriBrand<'content'>;
export type MaskUri = UxpUriBrand<'mask'>;

export type ContentType = 'canvas' | 'curlayer' | 'selection';
