import type {
  FileResourceCreateFromBufferPayload,
  FileResourceMaterializeRecord,
  FileResourceMaterializeResult,
} from '../context/WidgetImageMaskContext';

const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.bmp',
  '.webp',
  '.svg',
  '.heic',
  '.heif',
  '.tif',
  '.tiff',
  '.avif',
]);

const VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.mov',
  '.webm',
  '.mkv',
  '.avi',
  '.flv',
  '.wmv',
]);

export const getFileExtension = (fileName?: string | null): string | null => {
  if (!fileName) return null;
  const trimmed = fileName.trim();
  if (!trimmed) return null;
  const dot = trimmed.lastIndexOf('.');
  if (dot === -1) return null;
  const ext = trimmed.slice(dot).toLowerCase();
  return ext.length ? ext : null;
};

export const isImageMime = (mime?: string | null): boolean => {
  if (!mime) return false;
  return mime.toLowerCase().startsWith('image/');
};

export const isVideoMime = (mime?: string | null): boolean => {
  if (!mime) return false;
  return mime.toLowerCase().startsWith('video/');
};

export const isImageFile = (file: File): boolean => {
  if (isImageMime(file.type)) return true;
  const ext = getFileExtension(file.name);
  return !!ext && IMAGE_EXTENSIONS.has(ext);
};

export const isVideoFile = (file: File): boolean => {
  if (isVideoMime(file.type)) return true;
  const ext = getFileExtension(file.name);
  return !!ext && VIDEO_EXTENSIONS.has(ext);
};

export const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('Failed to read file'));
    };
    reader.readAsDataURL(file);
  });

export const buildBufferPayloadFromFile = async (
  file: File,
): Promise<FileResourceCreateFromBufferPayload> => {
  const mime = file.type && file.type.trim().length ? file.type : null;
  try {
    const dataUrl = await readFileAsDataUrl(file);
    if (dataUrl && dataUrl.trim().length) {
      return {
        buffer: dataUrl,
        name: file.name ?? undefined,
        mime,
      };
    }
  } catch {
    // fall through to ArrayBuffer fallback
  }
  const arrayBuffer = await file.arrayBuffer();
  return {
    buffer: arrayBuffer,
    name: file.name ?? undefined,
    mime,
  };
};

export const getSuccessfulMaterializeRecord = (
  result: FileResourceMaterializeResult | void | null | undefined,
): FileResourceMaterializeRecord | null => {
  if (!result) return null;
  const entries =
    Array.isArray(result.batch) && result.batch.length ? result.batch : [result];
  for (const entry of entries) {
    if (entry && entry.resource && !entry.error) {
      return entry;
    }
  }
  return null;
};

export const IMAGE_FILE_EXTENSIONS = IMAGE_EXTENSIONS;
export const VIDEO_FILE_EXTENSIONS = VIDEO_EXTENSIONS;
