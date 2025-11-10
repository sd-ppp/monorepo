import type { ActionContext } from './types';

const sanitizeLayerId = (raw: string | null | undefined): string | null => {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  return trimmed.length ? trimmed : null;
};

const extractLayerMetadata = (
  identify: string | null | undefined,
): { id: string | null; name: string | null } => {
  const value = sanitizeLayerId(identify);
  if (!value) {
    return { id: null, name: null };
  }
  const explicitMatch = /(.*)\(id:(\d+)\)\s*$/.exec(value);
  if (explicitMatch) {
    const baseName = explicitMatch[1].trim().replace(/^-+/, '').trim();
    return {
      id: explicitMatch[2],
      name: baseName.length ? baseName : value,
    };
  }
  if (/^\d+$/.test(value)) {
    return { id: value, name: value };
  }
  const inferredName = value.replace(/^-+/, '').trim();
  return {
    id: null,
    name: inferredName.length ? inferredName : value,
  };
};

const resolveLayerParams = (
  identifyCandidate: string | null,
  nameCandidate: string | null,
  fallbackIdentify: string | null,
): { id: string; name: string } => {
  const primaryMeta = extractLayerMetadata(nameCandidate ?? identifyCandidate);
  const fallbackMeta = extractLayerMetadata(fallbackIdentify);
  const idCandidate =
    sanitizeLayerId(primaryMeta.id) ??
    sanitizeLayerId(identifyCandidate) ??
    sanitizeLayerId(fallbackMeta.id) ??
    sanitizeLayerId(fallbackIdentify);
  const nameCandidateResolved =
    sanitizeLayerId(nameCandidate) ??
    primaryMeta.name ??
    fallbackMeta.name ??
    fallbackIdentify ??
    idCandidate ??
    '';
  const finalId = (idCandidate ?? nameCandidateResolved ?? '0').trim();
  const finalName = (nameCandidateResolved ?? finalId).trim();
  return { id: finalId, name: finalName };
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

  const existingLayerId = sanitizeLayerId(url.searchParams.get('layerid'));
    const existingLayerName = sanitizeLayerId(url.searchParams.get('layername'));
    const currentLayerId = sanitizeLayerId(ctx.getCurrentLayerId());
    const resolvedIdentify = existingLayerId ?? currentLayerId;

    if (!resolvedIdentify) {
      return { uri };
    }

    const { id, name } = resolveLayerParams(resolvedIdentify, existingLayerName, currentLayerId);
    url.searchParams.delete('layerId');
    url.searchParams.set('layerid', id);
    url.searchParams.set('layername', name);

    if (target === 'curlayer') {
      url.pathname = `/${docId}/layer`;
    }

    return { uri: url.toString() };
  } catch {
    const fallbackLayerId = sanitizeLayerId(ctx.getCurrentLayerId());
    if (!fallbackLayerId) return { uri };
    const [base, rawQuery] = uri.split('?');
    const params = new URLSearchParams(rawQuery ?? '');
    const { id, name } = resolveLayerParams(fallbackLayerId, null, fallbackLayerId);
    params.set('layerid', id);
    params.set('layername', name);
    const queryString = params.toString();
    return { uri: queryString ? `${base}?${queryString}` : base };
  }
};
