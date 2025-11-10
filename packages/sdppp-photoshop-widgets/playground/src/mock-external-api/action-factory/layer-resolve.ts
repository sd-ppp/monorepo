import type { ActionContext } from './types';

const sanitizeLayerId = (raw: string | null | undefined): string | null => {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  return trimmed.length ? trimmed : null;
};

export const resolveLayer = async (
  ctx: ActionContext,
  { uri }: { uri: string; type: 'content' | 'mask' }
) => {
  try {
    const url = new URL(uri);
    if (url.protocol !== 'uxp:' || (url.hostname !== 'content' && url.hostname !== 'mask')) {
      return { uri };
    }

    const segments = url.pathname.split('/').filter(Boolean);
    if (!segments.length) {
      return { uri };
    }

    const docId = segments[0] ?? '0';
    const target = segments[1] ?? '';

    const existingLayerId = sanitizeLayerId(url.searchParams.get('layerId'));
    const currentLayerId = ctx.getCurrentLayerId();
    const resolvedLayerId = existingLayerId ?? sanitizeLayerId(currentLayerId);

    if (!resolvedLayerId) {
      return { uri };
    }

    url.searchParams.set('layerId', resolvedLayerId);

    if (target === 'curlayer') {
      url.pathname = `/${docId}/layer`;
    }

    return { uri: url.toString() };
  } catch {
    const fallbackLayerId = sanitizeLayerId(ctx.getCurrentLayerId());
    if (!fallbackLayerId) return { uri };
    const glue = uri.includes('?') ? '&' : '?';
    return { uri: `${uri}${glue}layerId=${encodeURIComponent(fallbackLayerId)}` };
  }
};
