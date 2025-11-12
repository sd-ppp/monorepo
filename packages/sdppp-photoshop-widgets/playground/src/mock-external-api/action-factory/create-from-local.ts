import type {
  FileResourceMaterializeRecord,
  FileResourceMaterializeResult,
} from '../../../src/context/WidgetImageMaskContext';
import type { ActionContext } from './types';

type AcceptRecord = Record<string, string[]>;

interface CreateFromLocalTypeParam {
  description?: string;
  extensions?: string[];
  accept?: AcceptRecord;
}

interface CreateFromLocalParams {
  multiple?: boolean;
  types?: CreateFromLocalTypeParam[];
}

interface NormalizedTypeDescriptor {
  description?: string;
  extensions: string[];
  accept: AcceptRecord;
}

interface NormalizedSelectionParams {
  multiple?: boolean;
  types: NormalizedTypeDescriptor[];
}

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv']);
const EXTENSION_MIME_FALLBACK: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.flv': 'video/x-flv',
  '.wmv': 'video/x-ms-wmv',
};

const VIDEO_PLACEHOLDER_DATA_URL =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iOTYiIGhlaWdodD0iOTYiIHZpZXdCb3g9IjAgMCA5NiA5NiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iOTYiIGhlaWdodD0iOTYiIHJ4PSIxMiIgZmlsbD0iI0YwRjJGNSIvPjxwYXRoIGQ9Ik0zNyAzMmgyMmMyLjIgMCA0IDEuOCA0IDR2MjRjMCAyLjItMS44IDQtNCA0SDM3Yy0yLjIgMC00LTEuOC00LTRWMzZjMC0yLjIgMS44LTQgNC00Wm0yNCAxMi0xMiA4LTEyLTh2LTRsMTIgOCAxMi04djRaIiBmaWxsPSIjOEM4QzhDIi8+PC9zdmc+';

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

const measureImageSize = (src: string): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
    img.onerror = () => reject(new Error('Failed to load image for measurement'));
    img.src = src;
  });

const normalizeExtension = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return null;
  return trimmed.startsWith('.') ? trimmed : `.${trimmed}`;
};

const normalizeAcceptRecord = (value: unknown): AcceptRecord | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const result: AcceptRecord = {};
  for (const [mime, extensions] of Object.entries(value as Record<string, unknown>)) {
    if (typeof mime !== 'string' || !Array.isArray(extensions)) continue;
    const normalizedExtensions = extensions
      .map(normalizeExtension)
      .filter((ext): ext is string => Boolean(ext));
    if (!normalizedExtensions.length) continue;
    result[mime] = normalizedExtensions;
  }
  return Object.keys(result).length ? result : undefined;
};

const normalizeTypeParams = (params?: CreateFromLocalParams): NormalizedSelectionParams => {
  if (!params) {
    return { types: [] };
  }
  const normalizedTypes = Array.isArray(params.types)
    ? params.types
        .map(type => {
          if (!type || typeof type !== 'object') return null;
          const description =
            typeof type.description === 'string' && type.description.trim().length
              ? type.description.trim()
              : undefined;
          const extensions = Array.isArray(type.extensions)
            ? type.extensions
                .map(normalizeExtension)
                .filter((ext): ext is string => Boolean(ext))
            : [];
          const accept = normalizeAcceptRecord(type.accept);
          return {
            description,
            extensions,
            accept: accept ?? {},
          };
        })
        .filter((entry): entry is NormalizedTypeDescriptor => Boolean(entry))
    : [];
  return {
    multiple: typeof params.multiple === 'boolean' ? params.multiple : undefined,
    types: normalizedTypes,
  };
};

const extractExtensionFromFile = (file: File): string | null => {
  if (!file || typeof file.name !== 'string') return null;
  const dot = file.name.lastIndexOf('.');
  if (dot === -1) return null;
  return normalizeExtension(file.name.slice(dot));
};

const resolveMimeType = (file: File, extension: string | null): string => {
  if (file && typeof file.type === 'string' && file.type.trim().length) {
    return file.type;
  }
  if (extension && EXTENSION_MIME_FALLBACK[extension]) {
    return EXTENSION_MIME_FALLBACK[extension];
  }
  return 'application/octet-stream';
};

const createVideoResourceRecord = async (
  ctx: ActionContext,
  file: File,
  mime: string,
): Promise<FileResourceMaterializeRecord> => {
  const dataUrl = await readFileAsDataUrl(file);
  const record = ctx.resourceStore.createFromDataUrl(dataUrl, {
    width: 512,
    height: 288,
    mime,
    rect: {
      x: 0,
      y: 0,
      width: 512,
      height: 288,
    },
  });
  return {
    resource: record.resource,
    thumbnail: VIDEO_PLACEHOLDER_DATA_URL,
    width: record.width,
    height: record.height,
    mime,
    error: null,
  };
};

const buildAcceptMap = (descriptor: NormalizedTypeDescriptor): AcceptRecord => {
  if (descriptor.accept && Object.keys(descriptor.accept).length) {
    return descriptor.accept;
  }

  const entries: AcceptRecord = {};
  const extensions = descriptor.extensions.length
    ? descriptor.extensions
    : ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
  const group = (() => {
    const unique = new Set(extensions);
    const allImages = Array.from(unique).every(ext => IMAGE_EXTENSIONS.has(ext));
    if (allImages) return 'image/*';
    const allVideos = Array.from(unique).every(ext => VIDEO_EXTENSIONS.has(ext));
    if (allVideos) return 'video/*';
    if (unique.size === 1) {
      const [single] = Array.from(unique);
      return EXTENSION_MIME_FALLBACK[single] ?? 'application/octet-stream';
    }
    return 'application/octet-stream';
  })();
  entries[group] = extensions;
  return entries;
};

const buildInputAccept = (types: NormalizedTypeDescriptor[]): string => {
  const acceptSet = new Set<string>();
  if (!types.length) {
    acceptSet.add('image/*');
    return Array.from(acceptSet).join(',');
  }
  for (const type of types) {
    const accept = buildAcceptMap(type);
    for (const [mime, extensions] of Object.entries(accept)) {
      if (mime && mime !== 'application/octet-stream') {
        acceptSet.add(mime);
      }
      extensions.forEach(ext => acceptSet.add(ext));
    }
  }
  return Array.from(acceptSet).join(',');
};

const selectLocalFiles = async (params?: CreateFromLocalParams): Promise<File[]> => {
  const normalized = normalizeTypeParams(params);
  const normalizedTypes = normalized.types;
  const multiple = normalized.multiple ?? true;

  if (typeof window !== 'undefined' && 'showOpenFilePicker' in window) {
    try {
      const picker = (window as typeof window & {
        showOpenFilePicker?: (options?: {
          multiple?: boolean;
          types?: Array<{
            description?: string;
            accept: Record<string, string[]>;
          }>;
        }) => Promise<Array<{ getFile: () => Promise<File> }>>;
      }).showOpenFilePicker;

      if (picker) {
        const handles = await picker({
          multiple,
          types: normalizedTypes.length
            ? normalizedTypes.map(type => ({
                description: type.description,
                accept: buildAcceptMap(type),
              }))
            : [
                {
                  description: 'Images',
                  accept: {
                    'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
                  },
                },
              ],
        });
        const files = await Promise.all(handles.map(handle => handle.getFile()));
        return files.filter(Boolean);
      }
    } catch (pickerError) {
      if (pickerError && typeof pickerError === 'object' && 'name' in pickerError) {
        if ((pickerError as { name?: string }).name === 'AbortError') {
          return [];
        }
      }
      // fallback to input-based flow below
    }
  }

  return new Promise(resolve => {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      resolve([]);
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    const acceptAttr = buildInputAccept(normalizedTypes);
    if (acceptAttr) {
      input.accept = acceptAttr;
    }
    input.multiple = multiple;
    input.style.position = 'fixed';
    input.style.left = '-10000px';
    input.style.top = '-10000px';

    let settled = false;
    const cleanup = () => {
      input.remove();
      window.removeEventListener('focus', handleWindowFocus, true);
      input.removeEventListener('change', handleChange);
      input.removeEventListener('cancel', handleCancel);
    };

    const settle = (files: File[]) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(files);
    };

    const handleChange = () => {
      const files = input.files ? Array.from(input.files) : [];
      settle(files);
    };

    const handleCancel = () => {
      settle([]);
    };

    const handleWindowFocus = () => {
      setTimeout(() => {
        if (settled) return;
        const files = input.files ? Array.from(input.files) : [];
        settle(files);
      }, 1000);
    };

    input.addEventListener('change', handleChange);
    input.addEventListener('cancel', handleCancel);
    window.addEventListener('focus', handleWindowFocus, true);

    document.body.appendChild(input);
    input.click();
  });
};

const extractParams = (params?: Record<string, unknown>): CreateFromLocalParams | undefined => {
  if (!params || typeof params !== 'object') return undefined;
  const multiple = (params as { multiple?: unknown }).multiple;
  const types = (params as { types?: unknown }).types;
  return {
    multiple: typeof multiple === 'boolean' ? multiple : undefined,
    types: Array.isArray(types) ? (types as CreateFromLocalTypeParam[]) : undefined,
  };
};

export const createFromLocal = async (
  ctx: ActionContext,
  params?: Record<string, unknown>,
): Promise<FileResourceMaterializeResult> => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { resource: null, error: 'unsupported' };
  }

  try {
    const selectionParams = extractParams(params);
    const files = await selectLocalFiles(selectionParams);
    ctx.logger('mock resource.file.createFromLocal select', { count: files.length });
    if (!files.length) return { resource: null, error: 'cancelled' };

    const items: FileResourceMaterializeRecord[] = [];
    for (const file of files) {
      const extension = extractExtensionFromFile(file);
      const mime = resolveMimeType(file, extension);
      const isVideo =
        (typeof mime === 'string' && mime.startsWith('video/')) ||
        (extension ? VIDEO_EXTENSIONS.has(extension) : false);
      const isImage =
        (typeof mime === 'string' && mime.startsWith('image/')) ||
        (extension ? IMAGE_EXTENSIONS.has(extension) : false);

      if (isVideo) {
        const videoRecord = await createVideoResourceRecord(ctx, file, mime);
        items.push(videoRecord);
        continue;
      }

      if (!isImage) {
        items.push({ resource: null, error: 'unsupported-file-type' });
        continue;
      }

      try {
        const dataUrl = await readFileAsDataUrl(file);
        if (!dataUrl) {
          items.push({ resource: null, error: 'empty-data-url' });
          continue;
        }
        const { width, height } = await measureImageSize(dataUrl).catch(() => ({
          width: 512,
          height: 512,
        }));

        const record = ctx.resourceStore.createFromDataUrl(dataUrl, {
          width,
          height,
          mime,
          rect: {
            x: 0,
            y: 0,
            width,
            height,
          },
        });

        items.push({
          resource: record.resource,
          thumbnail: record.dataUrl,
          width: record.width,
          height: record.height,
          mime: record.mime,
          error: null,
        });
      } catch (innerError) {
        const message = innerError instanceof Error ? innerError.message : String(innerError);
        ctx.logger('mock resource.file.createFromLocal file error', message);
        items.push({ resource: null, error: message });
      }
    }

    const successful = items.filter(item => item.resource && !item.error);
    if (!successful.length) {
      return items[0] ?? { resource: null, error: 'no-successful-resource' };
    }

    const [primary] = successful;
    if (successful.length === 1) {
      return primary;
    }

    return {
      ...primary,
      batch: successful,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ctx.logger('mock resource.file.createFromLocal failed', message);
    return { resource: null, error: message };
  }
};
