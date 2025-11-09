import type {
  BoundaryRect,
  BoundarySetting,
  BoundaryUri,
  ContentType,
  ContentUri,
  MaskUri,
} from './types';

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export interface ParsedBoundary {
  docId: number;
  boundary: BoundarySetting;
}

export interface ParsedContent {
  docId: number;
  content: ContentType;
  layerIdentify: string | null;
}

export interface ParsedMask {
  docId: number;
  content: ContentType;
  layerIdentify: string | null;
  reverse: boolean;
}

type SupportedHosts = 'boundary' | 'content' | 'mask';

export const parseUxPResourceUri = (uri: string, expectedHost: SupportedHosts) => {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch (error) {
    throw new Error(`Invalid URI (${expectedHost}): ${uri}`);
  }

  if (parsed.protocol !== 'uxp:') {
    throw new Error(`Unsupported protocol for ${expectedHost}: ${uri}`);
  }

  if (parsed.hostname !== expectedHost) {
    throw new Error(`Expected ${expectedHost} URI but received ${parsed.hostname}`);
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length === 0) {
    throw new Error(`Missing document segment in ${expectedHost} URI: ${uri}`);
  }

  const docId = Number(segments[0]);
  if (!isFiniteNumber(docId)) {
    throw new Error(`Invalid document id in ${expectedHost} URI: ${uri}`);
  }

  return { url: parsed, docId, segments: segments.slice(1) };
};

export const parseBoundaryUri = (uri: BoundaryUri): ParsedBoundary => {
  const { url, docId, segments } = parseUxPResourceUri(uri, 'boundary');
  const target = segments[0] ?? 'canvas';

  if (target === 'canvas' || target === 'curlayer' || target === 'selection') {
    return { docId, boundary: target };
  }

  if (target !== 'rect') {
    throw new Error(`Unsupported boundary segment: ${target}`);
  }

  const getNumber = (key: keyof BoundaryRect): number => {
    const raw = url.searchParams.get(key);
    const value = raw === null ? NaN : Number(raw);
    return isFiniteNumber(value) ? value : 0;
  };

  const rect: BoundaryRect = {
    leftDistance: getNumber('leftDistance'),
    topDistance: getNumber('topDistance'),
    rightDistance: getNumber('rightDistance'),
    bottomDistance: getNumber('bottomDistance'),
    width: getNumber('width'),
    height: getNumber('height'),
  };

  return { docId, boundary: rect };
};

export const parseContentUri = (uri: ContentUri): ParsedContent => {
  const { url, docId, segments } = parseUxPResourceUri(uri, 'content');
  const target = segments[0];

  if (!target) {
    throw new Error(`Missing content segment in content URI: ${uri}`);
  }

  if (target === 'canvas' || target === 'selection' || target === 'curlayer') {
    return { docId, content: target, layerIdentify: null };
  }

  if (target === 'layer') {
    return {
      docId,
      content: 'curlayer',
      layerIdentify: url.searchParams.get('layerId'),
    };
  }

  throw new Error(`Unsupported content segment: ${target}`);
};

export const parseMaskUri = (uri: MaskUri): ParsedMask => {
  const { url, docId, segments } = parseUxPResourceUri(uri, 'mask');
  const target = segments[0];

  if (!target) {
    throw new Error(`Missing mask segment in mask URI: ${uri}`);
  }

  if (target === 'canvas' || target === 'selection' || target === 'curlayer') {
    return {
      docId,
      content: target === 'curlayer' ? 'curlayer' : (target as any),
      layerIdentify: null,
      reverse: url.searchParams.get('reverse') === '1' || url.searchParams.get('reverse') === 'true',
    };
  }

  if (target === 'layer') {
    return {
      docId,
      content: 'curlayer',
      layerIdentify: url.searchParams.get('layerId'),
      reverse: url.searchParams.get('reverse') === '1' || url.searchParams.get('reverse') === 'true',
    };
  }

  throw new Error(`Unsupported mask segment: ${target}`);
};

type UriKind = 'boundary' | 'content' | 'mask';

const detectUriKind = (uri: string): UriKind | null => {
  if (uri.startsWith('uxp://boundary')) return 'boundary';
  if (uri.startsWith('uxp://content')) return 'content';
  if (uri.startsWith('uxp://mask')) return 'mask';
  return null;
};

export const extractDocIdFromUris = (
  uris: Array<BoundaryUri | ContentUri | MaskUri | null | undefined>
): number | null => {
  for (const uri of uris) {
    if (!uri) continue;
    try {
      const kind = detectUriKind(uri);
      if (!kind) continue;
      const parsed = parseUxPResourceUri(uri, kind);
      return parsed.docId;
    } catch {
      continue;
    }
  }
  return null;
};
