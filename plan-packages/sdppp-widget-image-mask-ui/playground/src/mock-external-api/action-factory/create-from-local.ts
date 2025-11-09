import type {
  FileResourceMaterializeRecord,
  FileResourceMaterializeResult,
} from '../../../src/context/WidgetImageMaskContext';
import type { ActionContext } from './types';

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

const selectImageFiles = async (): Promise<File[]> => {
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
          multiple: true,
          types: [
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
    input.accept = 'image/*';
    input.multiple = true;
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

export const createFromLocal = async (ctx: ActionContext): Promise<FileResourceMaterializeResult> => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { resource: null, error: 'unsupported' };
  }

  try {
    const files = await selectImageFiles();
    ctx.logger('mock resource.file.createFromLocal select', { count: files.length });
    if (!files.length) return { resource: null, error: 'cancelled' };

    const items: FileResourceMaterializeRecord[] = [];
    for (const file of files) {
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
          mime: file.type || 'image/png',
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
