import type {
  FileResourceCreateFromBufferParams,
  FileResourceCreateFromBufferPayload,
  FileResourceMaterializeRecord,
  FileResourceMaterializeResult,
} from '../../../src/context/WidgetImageMaskContext';
import type { ActionContext } from './types';

const VIDEO_EXTENSIONS = new Set(['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv']);
const GENERIC_FILE_THUMBNAIL =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iOTYiIGhlaWdodD0iOTYiIHZpZXdCb3g9IjAgMCA5NiA5NiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iOTYiIGhlaWdodD0iOTYiIHJ4PSIxMiIgZmlsbD0iI0ZGRiIvPjx0ZXh0IHg9IjQ4IiB5PSI1MiIgZmlsbD0iI0EwQTAxMSIgZm9udC1mYW1pbHk9IkFyaWFsLCBIZWx2ZXRpY2EsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTYiIGZvbnQtd2VpZ2h0PSI3MDAiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkZJTEU8L3RleHQ+PC9zdmc+';
const VIDEO_PLACEHOLDER_DATA_URL =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iOTYiIGhlaWdodD0iOTYiIHZpZXdCb3g9IjAgMCA5NiA5NiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iOTYiIGhlaWdodD0iOTYiIHJ4PSIxMiIgZmlsbD0iI0YwRjJGNSIvPjxwYXRoIGQ9Ik0zNyAzMmgyMmMyLjIgMCA0IDEuOCA0IDR2MjRjMCAyLjItMS44IDQtNCA0SDM3Yy0yLjIgMC00LTEuOC00LTRWMzZjMC0yLjIgMS44LTQgNC00Wm0yNCAxMi0xMiA4LTEyLTh2LTRsMTIgOCAxMi04djRaIiBmaWxsPSIjOEM4QzhDIi8+PC9zdmc+';

const EXTENSION_MIME_FALLBACK: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.flv': 'video/x-flv',
  '.wmv': 'video/x-ms-wmv',
};

interface NormalizedBuffer {
  base64: string;
  mimeFromDataUrl?: string;
}

const normalizeExtension = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed.startsWith('.') ? trimmed : `.${trimmed}`;
};

const extensionFromName = (name?: string | null): string | null => {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  const dot = trimmed.lastIndexOf('.');
  if (dot === -1) return null;
  return normalizeExtension(trimmed.slice(dot));
};

const parseDataUrl = (value: string): NormalizedBuffer => {
  const match = value.match(/^data:([^;,]*)(;base64)?,(.*)$/s);
  if (!match) {
    throw new Error('invalid-data-url');
  }
  const [, mime = '', base64Flag, dataPart] = match;
  if (base64Flag) {
    return {
      base64: dataPart,
      mimeFromDataUrl: mime || undefined,
    };
  }
  const decoded = decodeURIComponent(dataPart);
  const bytes = stringToUint8Array(decoded);
  return {
    base64: uint8ArrayToBase64(bytes),
    mimeFromDataUrl: mime || undefined,
  };
};

const stringToUint8Array = (value: string): Uint8Array => {
  const bytes = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i += 1) {
    bytes[i] = value.charCodeAt(i) & 0xff;
  }
  return bytes;
};

const toUint8Array = (value: ArrayBuffer | ArrayBufferView | Uint8Array): Uint8Array => {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return new Uint8Array(value);
};

const uint8ArrayToBase64 = (bytes: Uint8Array): string => {
  const globalBuffer: any =
    typeof globalThis !== 'undefined' && (globalThis as any).Buffer ? (globalThis as any).Buffer : undefined;
  if (globalBuffer && typeof globalBuffer.from === 'function') {
    return globalBuffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
  }
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  if (typeof btoa === 'function') {
    return btoa(binary);
  }
  throw new Error('base64-encoding-unavailable');
};

const normaliseBufferSource = (payload: FileResourceCreateFromBufferPayload): NormalizedBuffer => {
  const { buffer } = payload;
  if (typeof buffer === 'string') {
    const trimmed = buffer.trim();
    if (!trimmed.length) {
      throw new Error('empty-buffer');
    }
    if (trimmed.startsWith('data:')) {
      return parseDataUrl(trimmed);
    }
    return { base64: trimmed };
  }

  if (buffer instanceof ArrayBuffer || ArrayBuffer.isView(buffer) || buffer instanceof Uint8Array) {
    const bytes = toUint8Array(buffer);
    return { base64: uint8ArrayToBase64(bytes) };
  }

  throw new Error('unsupported-buffer-source');
};

const buildDataUrl = (mime: string, base64: string): string => {
  const safeMime = mime && typeof mime === 'string' ? mime : 'application/octet-stream';
  return `data:${safeMime};base64,${base64}`;
};

const measureImageSize = (src: string): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
    img.onerror = () => reject(new Error('Failed to load image for measurement'));
    img.src = src;
  });

const ensureNumeric = (value: unknown): number | undefined => {
  if (typeof value !== 'number') return undefined;
  if (Number.isNaN(value) || !Number.isFinite(value)) return undefined;
  return value;
};

const normaliseMime = (mime?: string | null, extension?: string | null): string => {
  if (mime && typeof mime === 'string' && mime.trim().length) {
    return mime.trim().toLowerCase();
  }
  if (extension && EXTENSION_MIME_FALLBACK[extension]) {
    return EXTENSION_MIME_FALLBACK[extension];
  }
  return 'application/octet-stream';
};

const buildGenericThumbnail = (extension?: string | null): string => {
  if (extension && VIDEO_EXTENSIONS.has(extension)) {
    return VIDEO_PLACEHOLDER_DATA_URL;
  }
  return GENERIC_FILE_THUMBNAIL;
};

const resolveThumbnail = (
  provided: string | null | undefined,
  dataUrl: string,
  mime: string,
  extension: string | null,
): string | null => {
  if (provided && typeof provided === 'string' && provided.trim().length) {
    return provided;
  }
  if (mime.startsWith('image/')) {
    return dataUrl;
  }
  return buildGenericThumbnail(extension);
};

const resolveDimensions = async (
  dataUrl: string,
  mime: string,
  extension: string | null,
  width: number | undefined,
  height: number | undefined,
): Promise<{ width: number; height: number }> => {
  if (typeof width === 'number' && typeof height === 'number') {
    return { width, height };
  }
  if (mime.startsWith('image/')) {
    try {
      const measured = await measureImageSize(dataUrl);
      return {
        width: width ?? measured.width,
        height: height ?? measured.height,
      };
    } catch {
      return {
        width: width ?? 512,
        height: height ?? 512,
      };
    }
  }
  if (extension && VIDEO_EXTENSIONS.has(extension)) {
    return {
      width: width ?? 512,
      height: height ?? 288,
    };
  }
  return {
    width: width ?? 512,
    height: height ?? 512,
  };
};

export const createFromBuffer = async (
  ctx: ActionContext,
  params: FileResourceCreateFromBufferParams,
): Promise<FileResourceMaterializeResult> => {
  const files = Array.isArray(params?.files) ? params.files : [];

  if (!files.length) {
    ctx.logger('mock resource.file.createFromBuffer no files provided');
    return { resource: null, error: 'no-files' };
  }

  const results: FileResourceMaterializeRecord[] = [];

  for (const descriptor of files) {
    try {
      const normalizedBuffer = normaliseBufferSource(descriptor);
      const name = typeof descriptor.name === 'string' ? descriptor.name.trim() : '';
      const extension = extensionFromName(name) ?? null;
      const mime = normaliseMime(descriptor.mime ?? normalizedBuffer.mimeFromDataUrl, extension);
      const dataUrl = buildDataUrl(mime, normalizedBuffer.base64);

      const resolvedDimensions = await resolveDimensions(
        dataUrl,
        mime,
        extension,
        ensureNumeric(descriptor.width ?? null),
        ensureNumeric(descriptor.height ?? null),
      );

      const thumbnail = resolveThumbnail(descriptor.thumbnail, dataUrl, mime, extension);

      const record = ctx.resourceStore.createFromDataUrl(dataUrl, {
        width: resolvedDimensions.width,
        height: resolvedDimensions.height,
        mime,
      });

      results.push({
        resource: record.resource,
        thumbnail,
        width: record.width,
        height: record.height,
        mime,
        error: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      ctx.logger('mock resource.file.createFromBuffer failed', message);
      results.push({ resource: null, error: message });
    }
  }

  const successful = results.filter(entry => entry.resource && !entry.error);
  if (!successful.length) {
    return results[0] ?? { resource: null, error: 'no-successful-resource' };
  }

  const [primary, ...rest] = successful;
  if (!rest.length) {
    return primary;
  }

  return {
    ...primary,
    batch: successful,
  };
};
