import { useWidgetRenderMeta } from '@sdppp/widgetable-ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  useSelectionBoundary,
  useWidgetImageMaskActions,
  useWidgetLogger,
} from '../../../../context/WidgetImageMaskContext';
import { resolveDocContext } from '../../../../utils/docContext';
import { DEFAULT_CONTENT_URI } from '../../../../utils/resolveThumbnailParams';
import { parseLayerInfoFromUri } from '../utils';
import type { ImageSelectorProps, SourceMode } from '../types';

export interface UseImageSelectorStateParams
  extends Pick<ImageSelectorProps, 'value' | 'defaultAuto' | 'workBoundary'> {}

export interface ImageSelectorState {
  imageMaskActions: ReturnType<typeof useWidgetImageMaskActions>;
  logger: ReturnType<typeof useWidgetLogger>;
  selectionBoundary: ReturnType<typeof useSelectionBoundary>;
  renderMeta: ReturnType<typeof useWidgetRenderMeta>;
  resolvedDefaultAuto: boolean;
  initialValueUri: string;
  auto: boolean;
  applyAuto: (next: boolean, options?: { manual?: boolean }) => void;
  autoRef: React.MutableRefObject<boolean>;
  hasManualAutoChangeRef: React.MutableRefObject<boolean>;
  setAutoState: React.Dispatch<React.SetStateAction<boolean>>;
  fileUri: string;
  setFileUri: React.Dispatch<React.SetStateAction<string>>;
  contentUri: string;
  setContentUri: React.Dispatch<React.SetStateAction<string>>;
  boundaryUri: string;
  setBoundaryUri: React.Dispatch<React.SetStateAction<string>>;
  maskUri: string;
  setMaskUri: React.Dispatch<React.SetStateAction<string>>;
  layerInfo: {
    layerId: string | null;
    layerName: string | null;
    uri: string | null;
  } | null;
  setLayerInfo: React.Dispatch<
    React.SetStateAction<{
      layerId: string | null;
      layerName: string | null;
      uri: string | null;
    } | null>
  >;
  sourceMode: SourceMode;
  setSourceMode: (mode: SourceMode, options?: { manual?: boolean }) => void;
  sourceModeRef: React.MutableRefObject<SourceMode>;
  layerResolveRequestIdRef: React.MutableRefObject<number>;
  isGearButtonHovered: boolean;
  setIsGearButtonHovered: React.Dispatch<React.SetStateAction<boolean>>;
  isStatusBarHovered: boolean;
  setIsStatusBarHovered: React.Dispatch<React.SetStateAction<boolean>>;
  isStatusBarVisible: boolean;
  gearHoverTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  pendingManualFileRef: React.MutableRefObject<boolean>;
  lastKnownValueRef: React.MutableRefObject<string>;
  effectiveBoundaryUri: string;
  effectiveFileUri: string;
  derivedContentUri: string;
  ensureContentUri: () => string;
  resolveCurrentLayer: () => Promise<string | null>;
  curDocId: number;
  canvasContentFallback: string;
}

export const useImageSelectorState = ({
  value,
  defaultAuto = true,
  workBoundary,
}: UseImageSelectorStateParams): ImageSelectorState => {
  const imageMaskActions = useWidgetImageMaskActions();
  const selectionBoundary = useSelectionBoundary();
  const logger = useWidgetLogger();
  const renderMeta = useWidgetRenderMeta();

  const resolvedDefaultAuto = useMemo(() => {
    if (!defaultAuto) {
      return false;
    }
    if (!renderMeta) {
      return true;
    }
    return renderMeta.sameTypeIndex === 0;
  }, [defaultAuto, renderMeta]);

  const initialValueUri = useMemo(() => (value?.[0] ?? '').trim(), [value]);

  const [fileUri, setFileUri] = useState<string>('');
  const [contentUri, setContentUri] = useState<string>('');
  const [boundaryUri, setBoundaryUri] = useState<string>(workBoundary);
  const [maskUri, setMaskUri] = useState<string>('');
  const [auto, setAutoState] = useState<boolean>(resolvedDefaultAuto);
  const [layerInfo, setLayerInfo] = useState<{
    layerId: string | null;
    layerName: string | null;
    uri: string | null;
  } | null>(null);
  const [sourceModeInternal, setSourceModeInternal] = useState<SourceMode>('canvas');
  const [isGearButtonHovered, setIsGearButtonHovered] = useState(false);
  const [isStatusBarHovered, setIsStatusBarHovered] = useState(false);

  const sourceModeRef = useRef<SourceMode>(sourceModeInternal);
  const layerResolveRequestIdRef = useRef(0);
  const gearHoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setSourceMode = useCallback(
    (mode: SourceMode, options?: { manual?: boolean }) => {
      sourceModeRef.current = mode;
      setSourceModeInternal(mode);
    },
    [],
  );

  const sourceMode = sourceModeInternal;

  useEffect(() => {
    sourceModeRef.current = sourceModeInternal;
  }, [sourceModeInternal]);

  const isStatusBarVisible = isGearButtonHovered || isStatusBarHovered;

  useEffect(
    () => () => {
      if (gearHoverTimeoutRef.current) {
        clearTimeout(gearHoverTimeoutRef.current);
        gearHoverTimeoutRef.current = null;
      }
    },
    [],
  );

  const autoRef = useRef<boolean>(auto);
  const hasManualAutoChangeRef = useRef<boolean>(false);

  useEffect(() => {
    autoRef.current = auto;
  }, [auto]);

  const applyAuto = useCallback(
    (next: boolean, options?: { manual?: boolean }) => {
      if (options?.manual) {
        hasManualAutoChangeRef.current = true;
      }
      autoRef.current = next;
      setAutoState(next);
    },
    [setAutoState],
  );

  useEffect(() => {
    if (hasManualAutoChangeRef.current) {
      return;
    }
    const expected = resolvedDefaultAuto;
    if (autoRef.current !== expected) {
      autoRef.current = expected;
      setAutoState(expected);
    }
  }, [resolvedDefaultAuto, setAutoState]);

  const pendingManualFileRef = useRef(false);
  const lastKnownValueRef = useRef<string>(initialValueUri);

  const { docId: curDocId, canvasContentUri: canvasContentFallback } = useMemo(
    () => resolveDocContext(workBoundary),
    [workBoundary],
  );

  useEffect(() => {
    const incoming = (value?.[0] ?? '').trim();
    if (!incoming) {
      return;
    }
    if (pendingManualFileRef.current) {
      if (incoming === lastKnownValueRef.current && incoming.length > 0) {
        pendingManualFileRef.current = false;
      } else {
        return;
      }
    }
    lastKnownValueRef.current = incoming;
  }, [value]);

  useEffect(() => {
    setBoundaryUri(workBoundary);
    setContentUri('');
  }, [workBoundary]);

  const effectiveBoundaryUri = boundaryUri || workBoundary;
  const effectiveFileUri = (fileUri || '').trim();

  const derivedContentUri = useMemo(() => {
    const normalizedContentUri = contentUri.trim();
    if (normalizedContentUri) return normalizedContentUri;
    if (!effectiveBoundaryUri) return DEFAULT_CONTENT_URI;
    return curDocId > 0 ? canvasContentFallback : DEFAULT_CONTENT_URI;
  }, [contentUri, effectiveBoundaryUri, canvasContentFallback, curDocId]);

  const ensureContentUri = useCallback(() => {
    const normalized = contentUri.trim();
    if (normalized) {
      return normalized;
    }
    const fallback = derivedContentUri.trim() ? derivedContentUri : DEFAULT_CONTENT_URI;
    setContentUri(fallback);
    return fallback;
  }, [contentUri, derivedContentUri]);

  const resolveCurrentLayer = useCallback(async (): Promise<string | null> => {
    let targetUri: string | null = null;
    if (curDocId > 0) {
      targetUri = `uxp://content/${curDocId}/curlayer`;
    }
    if (!targetUri) {
      const candidates = [
        contentUri.trim(),
        (effectiveBoundaryUri ?? '').trim(),
        derivedContentUri.trim(),
      ].filter(Boolean) as string[];
      targetUri = candidates[0] ?? null;
    }
    if (!targetUri) {
      setLayerInfo(null);
      return null;
    }
    const requestId = ++layerResolveRequestIdRef.current;
    try {
      const resolver = imageMaskActions['resource.layer.resolve'];
      const result = await resolver({ uri: targetUri, type: 'content' });
      if (layerResolveRequestIdRef.current !== requestId) {
        return (result?.uri ?? targetUri)?.trim() ?? null;
      }
      const resolvedUri = (result?.uri ?? targetUri).trim();
      const parsed = parseLayerInfoFromUri(resolvedUri);
      setLayerInfo({
        layerId: result?.layerId ?? parsed.layerId,
        layerName: result?.layerName ?? parsed.layerName,
        uri: resolvedUri || null,
      });
      if (resolvedUri && resolvedUri !== contentUri.trim()) {
        setContentUri(resolvedUri);
      }
      return resolvedUri || null;
    } catch (error) {
      if (layerResolveRequestIdRef.current === requestId) {
        setLayerInfo(null);
        logger(
          'ImageSelector layer resolve error',
          JSON.stringify({
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          }),
        );
      }
      return null;
    }
  }, [contentUri, curDocId, derivedContentUri, effectiveBoundaryUri, imageMaskActions, logger]);

  useEffect(() => {
    if (sourceMode !== 'layer') {
      setLayerInfo(null);
      return;
    }
    void resolveCurrentLayer();
  }, [resolveCurrentLayer, sourceMode]);

  return {
    imageMaskActions,
    logger,
    selectionBoundary,
    renderMeta,
    resolvedDefaultAuto,
    initialValueUri,
    auto,
    applyAuto,
    autoRef,
    hasManualAutoChangeRef,
    setAutoState,
    fileUri,
    setFileUri,
    contentUri,
    setContentUri,
    boundaryUri,
    setBoundaryUri,
    maskUri,
    setMaskUri,
    layerInfo,
    setLayerInfo,
    sourceMode,
    setSourceMode,
    sourceModeRef,
    layerResolveRequestIdRef,
    isGearButtonHovered,
    setIsGearButtonHovered,
    isStatusBarHovered,
    setIsStatusBarHovered,
    isStatusBarVisible,
    gearHoverTimeoutRef,
    pendingManualFileRef,
    lastKnownValueRef,
    effectiveBoundaryUri,
    effectiveFileUri,
    derivedContentUri,
    ensureContentUri,
    resolveCurrentLayer,
    curDocId,
    canvasContentFallback,
  };
};
