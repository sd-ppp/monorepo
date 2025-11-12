import { AUTO_SPIN_STYLE_ID } from './constants';
import type { ParsedLayerInfo, SourceMode, TranslateFn } from './types';

export const ensureAutoSpinStyle = () => {
  if (typeof document === 'undefined') return;
  if (document.getElementById(AUTO_SPIN_STYLE_ID)) return;
  const styleElement = document.createElement('style');
  styleElement.id = AUTO_SPIN_STYLE_ID;
  styleElement.textContent = `
    @keyframes sdppp-sync-button-spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(styleElement);
};

export const resolveContentTooltip = (uri: string, translate: TranslateFn): string | undefined => {
  const normalized = uri?.trim();
  if (!normalized) return undefined;

  const resolveLayerTooltip = (layerName?: string | null) => {
    const trimmed = layerName?.trim();
    if (trimmed) {
      return translate('image.upload.tooltip.current.layer_named', {
        defaultValue: `Current selection: Layer ${trimmed}`,
        layerName: trimmed,
      });
    }
    return translate('image.upload.tooltip.current.layer', {
      defaultValue: 'Current selection: Layer',
    });
  };

  try {
    const parsed = new URL(normalized);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    if (lastSegment === 'canvas') {
      return translate('image.upload.tooltip.current.canvas', {
        defaultValue: 'Current selection: Canvas',
      });
    }
    if (lastSegment === 'layer') {
      return resolveLayerTooltip(parsed.searchParams.get('layername'));
    }
  } catch {
    // ignore parsing errors and fallback to string checks
  }

  if (normalized.endsWith('/canvas')) {
    return translate('image.upload.tooltip.current.canvas', {
      defaultValue: 'Current selection: Canvas',
    });
  }
  if (/\/layer(?:\/|\?|$)/.test(normalized)) {
    const match = /layername=([^&#]+)/.exec(normalized);
    const layerName = match ? decodeURIComponent(match[1]) : undefined;
    return resolveLayerTooltip(layerName);
  }

  return undefined;
};

export const parseLayerInfoFromUri = (uri?: string | null): ParsedLayerInfo => {
  if (!uri) {
    return { layerId: null, layerName: null };
  }

  const normalized = uri.trim();
  if (!normalized) {
    return { layerId: null, layerName: null };
  }

  try {
    const parsed = new URL(normalized);
    const layerId =
      parsed.searchParams.get('layerid') ??
      parsed.searchParams.get('id') ??
      (() => {
        const segments = parsed.pathname.split('/').filter(Boolean);
        const maybeLayerIndex = segments.findIndex(segment => segment === 'layer');
        if (maybeLayerIndex >= 0 && maybeLayerIndex < segments.length - 1) {
          return segments[maybeLayerIndex + 1];
        }
        return null;
      })();
    const layerName = parsed.searchParams.get('layername');
    return {
      layerId: layerId ?? null,
      layerName: layerName ? decodeURIComponent(layerName) : null,
    };
  } catch {
    const idMatch = /layer\/([^/?#]+)/.exec(normalized);
    const nameMatch = /layername=([^&#]+)/.exec(normalized);
    return {
      layerId: idMatch ? idMatch[1] : null,
      layerName: nameMatch ? decodeURIComponent(nameMatch[1]) : null,
    };
  }
};

export const inferSourceModeFromContent = ({
  contentUri,
  derivedContentUri,
}: {
  contentUri?: string | null;
  derivedContentUri?: string | null;
}): SourceMode => {
  const candidates = [contentUri, derivedContentUri]
    .map(candidate => candidate?.trim())
    .filter((candidate): candidate is string => Boolean(candidate));

  const target = candidates[0];
  if (!target) {
    return 'canvas';
  }

  if (/\/(layer|curlayer)(?:\/|\?|$)/.test(target)) {
    return 'layer';
  }

  if (target.endsWith('/canvas')) {
    return 'canvas';
  }

  return 'canvas';
};
