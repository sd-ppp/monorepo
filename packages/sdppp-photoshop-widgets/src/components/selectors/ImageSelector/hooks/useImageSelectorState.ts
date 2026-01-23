import { useWidgetRenderMeta } from '@sdppp/widgetable-ui';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import {
  useSelectionBoundary,
  usePhotoshopWidgetActions,
  type ResourceHandle,
} from '../../../../context/PhotoshopWidgetContext';
import type { ImageSelectorProps, SourceMode } from '../types';
import { useImageResourceState, type DocScopedUriSnapshot } from './useImageResourceState';
import { useAutoState } from './useAutoState';
import { useLayerModeState } from './useLayerModeState';
import { useInteractionState } from './useInteractionState';

export interface UseImageSelectorStateParams
  extends Pick<ImageSelectorProps, 'value' | 'defaultAuto' | 'workBoundary'> {}

export interface ImageSelectorState {
  imageMaskActions: ReturnType<typeof usePhotoshopWidgetActions>;
  selectionBoundary: ReturnType<typeof useSelectionBoundary>;
  hasSelectionBoundary: boolean;
  renderMeta: ReturnType<typeof useWidgetRenderMeta>;
  resolvedDefaultAuto: boolean;
  initialValueUri: string;
  auto: boolean;
  applyAuto: (next: boolean, options?: { manual?: boolean }) => void;
  autoRef: MutableRefObject<boolean>;
  hasManualAutoChangeRef: MutableRefObject<boolean>;
  setAutoState: Dispatch<SetStateAction<boolean>>;
  diskFileUri: string;
  setDiskFileResource: (resource: string, handle?: ResourceHandle | null) => void;
  contentUri: string;
  setContentUri: Dispatch<SetStateAction<string>>;
  setPreparedContentResource: (resource: string, handle?: ResourceHandle | null) => void;
  boundaryUri: string;
  setBoundaryUri: Dispatch<SetStateAction<string>>;
  maskUri: string;
  setMaskResource: (resource: string, handle?: ResourceHandle | null) => void;
  resultSnapshotUri: string;
  setResultSnapshotResource: (resource: string, handle?: ResourceHandle | null) => void;
  clearResultSnapshot: () => void;
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
  isGearButtonHovered: boolean;
  setIsGearButtonHovered: Dispatch<SetStateAction<boolean>>;
  isStatusBarHovered: boolean;
  setIsStatusBarHovered: Dispatch<SetStateAction<boolean>>;
  isMaskButtonHovered: boolean;
  setIsMaskButtonHovered: Dispatch<SetStateAction<boolean>>;
  isStatusBarVisible: boolean;
  gearHoverTimeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  pendingManualFileRef: MutableRefObject<boolean>;
  lastKnownValueRef: MutableRefObject<string>;
  resolveCurrentLayer: () => Promise<{ contentUri: string | null; boundaryUri: string | null }>;
  curDocId: number;
  diskFileHandleRef: MutableRefObject<ResourceHandle | null>;
  contentHandleRef: MutableRefObject<ResourceHandle | null>;
  maskHandleRef: MutableRefObject<ResourceHandle | null>;
  maskHandleResourceRef: MutableRefObject<string | null>;
  workBoundary: string;
  isInitialState: boolean;
  setInitialState: Dispatch<SetStateAction<boolean>>;
  syncDocScopedUrisIfNeeded: () => DocScopedUriSnapshot;
}

export const useImageSelectorState = ({
  value,
  defaultAuto = true,
  workBoundary,
}: UseImageSelectorStateParams): ImageSelectorState => {
  const imageMaskActions = usePhotoshopWidgetActions();
  const selectionBoundary = useSelectionBoundary();
  const hasSelectionBoundary = Boolean(
    selectionBoundary &&
      Number.isFinite(selectionBoundary.width) &&
      Number.isFinite(selectionBoundary.height) &&
      selectionBoundary.width > 0 &&
      selectionBoundary.height > 0,
  );
  const renderMeta = useWidgetRenderMeta();

  const normalizedWorkBoundary = (workBoundary ?? '').trim();
  const resourceState = useImageResourceState({ workBoundary });
  const autoState = useAutoState({ value, defaultAuto, renderMeta });
  const layerModeState = useLayerModeState({
    imageMaskActions,
    contentUri: resourceState.contentUri,
    setContentUri: resourceState.setContentUri,
    boundaryForResolution: resourceState.boundaryUri || normalizedWorkBoundary,
    curDocId: resourceState.curDocId,
  });
  const interactionState = useInteractionState();

  return {
    imageMaskActions,
    selectionBoundary,
    hasSelectionBoundary,
    renderMeta,
    resolvedDefaultAuto: autoState.resolvedDefaultAuto,
    initialValueUri: autoState.initialValueUri,
    auto: autoState.auto,
    applyAuto: autoState.applyAuto,
    autoRef: autoState.autoRef,
    hasManualAutoChangeRef: autoState.hasManualAutoChangeRef,
    setAutoState: autoState.setAutoState,
    diskFileUri: resourceState.diskFileUri,
    setDiskFileResource: resourceState.setDiskFileResource,
    contentUri: resourceState.contentUri,
    setContentUri: resourceState.setContentUri,
    setPreparedContentResource: resourceState.setPreparedContentResource,
    boundaryUri: resourceState.boundaryUri,
    setBoundaryUri: resourceState.setBoundaryUri,
    maskUri: resourceState.maskUri,
    setMaskResource: resourceState.setMaskResource,
    resultSnapshotUri: resourceState.resultSnapshotUri,
    setResultSnapshotResource: resourceState.setResultSnapshotResource,
    clearResultSnapshot: resourceState.clearResultSnapshot,
    isInitialState: resourceState.isInitialState,
    setInitialState: resourceState.setIsInitialState,
    layerInfo: layerModeState.layerInfo,
    setLayerInfo: layerModeState.setLayerInfo,
    sourceMode: layerModeState.sourceMode,
    setSourceMode: layerModeState.setSourceMode,
    sourceModeRef: layerModeState.sourceModeRef,
    layerResolveRequestIdRef: layerModeState.layerResolveRequestIdRef,
    isGearButtonHovered: interactionState.isGearButtonHovered,
    setIsGearButtonHovered: interactionState.setIsGearButtonHovered,
    isStatusBarHovered: interactionState.isStatusBarHovered,
    setIsStatusBarHovered: interactionState.setIsStatusBarHovered,
    isMaskButtonHovered: interactionState.isMaskButtonHovered,
    setIsMaskButtonHovered: interactionState.setIsMaskButtonHovered,
    isStatusBarVisible: interactionState.isStatusBarVisible,
    gearHoverTimeoutRef: interactionState.gearHoverTimeoutRef,
    pendingManualFileRef: autoState.pendingManualFileRef,
    lastKnownValueRef: autoState.lastKnownValueRef,
    resolveCurrentLayer: layerModeState.resolveCurrentLayer,
    curDocId: resourceState.curDocId,
    diskFileHandleRef: resourceState.diskFileHandleRef,
    contentHandleRef: resourceState.contentHandleRef,
    maskHandleRef: resourceState.maskHandleRef,
    maskHandleResourceRef: resourceState.maskHandleResourceRef,
    workBoundary: normalizedWorkBoundary,
    syncDocScopedUrisIfNeeded: resourceState.syncDocScopedUrisIfNeeded,
  };
};
