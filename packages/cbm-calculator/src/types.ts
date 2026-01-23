import type { Jimp as JimpInstance } from 'jimp';

export interface StageRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Snapshot {
  image: JimpInstance;
  rect: StageRect;
}

export interface MaskSnapshot extends Snapshot {
  maskRegion?: StageRect | null;
}
