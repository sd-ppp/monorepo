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

const parseUxpResourceUri = (uri: string, expectedHost: SupportedHosts) => {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch (error) {
    throw new Error(`Invalid ${expectedHost} URI: ${uri}`);
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
  const { url, docId, segments } = parseUxpResourceUri(uri, 'boundary');
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
  const { url, docId, segments } = parseUxpResourceUri(uri, 'content');
  const target = segments[0];

  if (!target) {
    throw new Error(`Missing content segment in content URI: ${uri}`);
  }

  if (target === 'canvas' || target === 'selection') {
    return { docId, content: target, layerIdentify: null };
  }

  if (target === 'curlayer') {
    return {
      docId,
      content: 'curlayer',
      layerIdentify: url.searchParams.get('layerid'),
    };
  }

  if (target === 'layer') {
    const layerIdentify = url.searchParams.get('layerid');
    if (!layerIdentify) {
      throw new Error(`Missing layerid query parameter in content URI: ${uri}`);
    }
    return {
      docId,
      content: 'curlayer',
      layerIdentify,
    };
  }

  throw new Error(`Unsupported content segment: ${target}`);
};

export const parseMaskUri = (uri: MaskUri): ParsedMask => {
  const { url, docId, segments } = parseUxpResourceUri(uri, 'mask');
  const target = segments[0];

  if (!target) {
    throw new Error(`Missing mask segment in mask URI: ${uri}`);
  }

  const reverse = url.searchParams.get('reverse') === '1' || url.searchParams.get('reverse') === 'true';

  if (target === 'canvas' || target === 'selection' || target === 'curlayer') {
    return {
      docId,
      content: target === 'curlayer' ? 'curlayer' : target,
      layerIdentify: null,
      reverse,
    };
  }

  if (target === 'layer') {
    const layerIdentify = url.searchParams.get('layerid');
    if (!layerIdentify) {
      throw new Error(`Missing layerid query parameter in mask URI: ${uri}`);
    }
    return {
      docId,
      content: 'curlayer',
      layerIdentify,
      reverse,
    };
  }

  throw new Error(`Unsupported mask segment: ${target}`);
};
