import { Buffer } from 'buffer/';

const dataUrlPattern = /^data:([^;,]*)(;base64)?,(.*)$/i;

if (typeof globalThis !== 'undefined' && typeof (globalThis as any).Buffer === 'undefined') {
  (globalThis as any).Buffer = Buffer as unknown as (typeof globalThis)['Buffer'];
}

const decodeBase64 = (payload: string): Uint8Array => Buffer.from(payload, 'base64');

export const dataUrlToBytes = (dataUrl: string): { bytes: Uint8Array; mimeType?: string } => {
  const match = dataUrlPattern.exec(dataUrl);
  if (!match) {
    throw new Error('Invalid data URL');
  }
  const [, mime = '', base64Flag, payload = ''] = match;
  const isBase64 = Boolean(base64Flag);
  if (isBase64) {
    return { bytes: decodeBase64(payload), mimeType: mime || undefined };
  }
  const decoded = decodeURIComponent(payload);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i += 1) {
    bytes[i] = decoded.charCodeAt(i);
  }
  return { bytes, mimeType: mime || undefined };
};
