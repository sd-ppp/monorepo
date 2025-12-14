import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type { usePhotoshopWidgetActions } from '../../../../context/PhotoshopWidgetContext';
import { parseLayerInfoFromUri } from '../utils';
import type { SourceMode } from '../types';

export interface LayerModeState {
  layerInfo: {
    layerId: string | null;
    layerName: string | null;
    uri: string | null;
  } | null;
  setLayerInfo: Dispatch<
    SetStateAction<{
      layerId: string | null;
      layerName: string | null;
      uri: string | null;
    } | null>
  >;
  sourceMode: SourceMode;
  setSourceMode: (mode: SourceMode, options?: { manual?: boolean }) => void;
  sourceModeRef: MutableRefObject<SourceMode>;
  layerResolveRequestIdRef: MutableRefObject<number>;
  resolveCurrentLayer: () => Promise<{ contentUri: string | null; boundaryUri: string | null }>;
}

export const useLayerModeState = ({
  imageMaskActions,
  contentUri,
  setContentUri,
  boundaryForResolution,
  curDocId,
}: {
  imageMaskActions: ReturnType<typeof usePhotoshopWidgetActions>;
  contentUri: string;
  setContentUri: Dispatch<SetStateAction<string>>;
  boundaryForResolution: string;
  curDocId: number;
}): LayerModeState => {
  const [layerInfo, setLayerInfo] = useState<{
    layerId: string | null;
    layerName: string | null;
    uri: string | null;
  } | null>(null);
  const [sourceModeInternal, setSourceModeInternal] = useState<SourceMode>('canvas');

  const sourceModeRef = useRef<SourceMode>(sourceModeInternal);
  const layerResolveRequestIdRef = useRef(0);

  const setSourceMode = useCallback(
    (mode: SourceMode, _options?: { manual?: boolean }) => {
      sourceModeRef.current = mode;
      setSourceModeInternal(mode);
    },
    [],
  );

  useEffect(() => {
    sourceModeRef.current = sourceModeInternal;
  }, [sourceModeInternal]);

  const resolveCurrentLayer = useCallback(async (): Promise<{ contentUri: string | null; boundaryUri: string | null }> => {
    const normalizedBoundaryForResolution = boundaryForResolution.trim();

    let targetUri: string | null = null;
    if (curDocId > 0) {
      targetUri = `uxp://content/${curDocId}/curlayer`;
    }
    if (!targetUri) {
      const candidates = [
        contentUri.trim(),
        boundaryForResolution.trim(),
      ].filter(Boolean) as string[];
      targetUri = candidates[0] ?? null;
    }
    if (!targetUri) {
      setLayerInfo(null);
      return { contentUri: null, boundaryUri: null };
    }
    const requestId = ++layerResolveRequestIdRef.current;
    try {
      const resolver = imageMaskActions['resource.layer.resolve'];
      const result = await resolver({ uri: targetUri, type: 'content' });
      if (layerResolveRequestIdRef.current !== requestId) {
        const resolvedUri = (result?.uri ?? targetUri)?.trim() ?? null;
        const resolvedBoundaryCandidate =
          typeof result?.boundaryUri === 'string' ? result.boundaryUri.trim() : '';
        return { contentUri: resolvedUri, boundaryUri: resolvedBoundaryCandidate || null };
      }
      const resolvedUri = (result?.uri ?? targetUri).trim();
      const parsed = parseLayerInfoFromUri(resolvedUri);
      setLayerInfo({
        layerId: result?.layerId ?? parsed.layerId,
        layerName: result?.layerName ?? parsed.layerName,
        uri: resolvedUri || null,
      });
      const resolvedBoundaryCandidate =
        typeof result?.boundaryUri === 'string' ? result.boundaryUri.trim() : '';
      if (resolvedUri && resolvedUri !== contentUri.trim()) {
        setContentUri(resolvedUri);
      }
      return {
        contentUri: resolvedUri || null,
        boundaryUri: resolvedBoundaryCandidate || null,
      };
    } catch (_error) {
      if (layerResolveRequestIdRef.current === requestId) {
        setLayerInfo(null);
      }
      return { contentUri: null, boundaryUri: null };
    }
  }, [
    contentUri,
    curDocId,
    boundaryForResolution,
    imageMaskActions,
    setContentUri,
  ]);

  useEffect(() => {
    if (sourceModeInternal !== 'layer') {
      setLayerInfo(null);
      return;
    }
    void resolveCurrentLayer();
  }, [resolveCurrentLayer, sourceModeInternal]);

  return {
    layerInfo,
    setLayerInfo,
    sourceMode: sourceModeInternal,
    setSourceMode,
    sourceModeRef,
    layerResolveRequestIdRef,
    resolveCurrentLayer,
  };
};
