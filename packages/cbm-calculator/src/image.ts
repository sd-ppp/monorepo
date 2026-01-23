import { Buffer } from 'buffer/';
import { Jimp, JimpMime, rgbaToInt, type Jimp as JimpInstance } from 'jimp';

import type { StageRect } from './types';

if (typeof globalThis !== 'undefined' && typeof (globalThis as any).Buffer === 'undefined') {
  (globalThis as any).Buffer = Buffer as unknown as (typeof globalThis)['Buffer'];
}

const normalizeBuffer = (input: ArrayBuffer | Uint8Array): Uint8Array =>
  input instanceof Uint8Array ? input : new Uint8Array(input);

const readImageFromBinary = async (bytes: Uint8Array, mimeType?: string): Promise<JimpInstance> => {
  try {
    const nodeBuffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return await Jimp.read(nodeBuffer as any);
  } catch {
    if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const blob = new Blob([bytes], { type: mimeType ?? 'application/octet-stream' });
      const objectUrl = URL.createObjectURL(blob);
      try {
        return await Jimp.read(objectUrl);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    }
    throw new Error('Binary image decoding is not supported in this environment');
  }
};

export const createSolidColorImage = async (rect: StageRect, color: string): Promise<JimpInstance> => {
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const rgba = (() => {
    const match = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(\d*\.?\d+))?\s*\)$/i.exec(color);
    if (!match) return { r: 0, g: 0, b: 0, a: 0 };
    const r = Math.min(255, Math.max(0, Number(match[1])));
    const g = Math.min(255, Math.max(0, Number(match[2])));
    const b = Math.min(255, Math.max(0, Number(match[3])));
    const alphaRaw = match[4] != null ? Number(match[4]) : 1;
    const a = Math.min(255, Math.max(0, alphaRaw <= 1 ? Math.round(alphaRaw * 255) : Math.round(alphaRaw)));
    return { r, g, b, a };
  })();

  const jimpImage = await new Jimp({
    width,
    height,
    color: rgbaToInt(rgba.r, rgba.g, rgba.b, rgba.a),
  });
  return jimpImage;
};

export const readImage = async (
  src: string | ArrayBuffer | Uint8Array,
  options?: { mimeType?: string; signal?: AbortSignal }
): Promise<JimpInstance> => {
  if (typeof src === 'string') {
    options?.signal?.throwIfAborted?.();
    return await Jimp.read(src);
  }
  options?.signal?.throwIfAborted?.();
  const buffer = normalizeBuffer(src);
  return readImageFromBinary(buffer, options?.mimeType);
};

export const jimpToDataUrl = (image: JimpInstance): Promise<string> => image.getBase64(JimpMime.png);

export const jimpToBuffer = async (
  image: JimpInstance,
  mime: string = JimpMime.png
): Promise<Uint8Array> => {
  const buffer = await image.getBuffer(mime);
  return buffer instanceof Uint8Array ? new Uint8Array(buffer) : Uint8Array.from(buffer as unknown as number[]);
};

export { JimpMime };
