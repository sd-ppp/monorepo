import React, { useEffect, useMemo, useRef, useState, type CSSProperties, type FC } from 'react';

import { Typography } from 'antd';

import { useWidgetText } from '../../context/PhotoshopWidgetContext';
import { resolveDocContext } from '../../utils/docContext';
import { PreviewPanelPresentation } from './ImageSelector/PreviewPanelPresentation';
import { useImageSelectorState } from './ImageSelector/hooks/useImageSelectorState';
import { useImageSelectorComputed } from './ImageSelector/hooks/useImageSelectorComputed';
import { useImageUploadWorkflow } from './ImageSelector/hooks/useImageUploadWorkflow';
import type { ImageSelectorProps } from './ImageSelector/types';

const AUTO_CONTENT_PRESETS = ['canvas', 'curlayer'] as const;
type AutoContentPreset = (typeof AUTO_CONTENT_PRESETS)[number];

const AUTO_BOUNDARY_PRESETS = ['canvas', 'curlayer', 'selection'] as const;
type AutoBoundaryPreset = (typeof AUTO_BOUNDARY_PRESETS)[number];

const AUTO_MASK_PRESETS = ['canvas', 'curlayer', 'selection', 'smart_selection'] as const;
type AutoMaskPreset = (typeof AUTO_MASK_PRESETS)[number];

const normalizePreset = <T extends readonly string[]>(
  value: string | null | undefined,
  presets: T,
  fallback: T[number],
): T[number] => {
  if (typeof value !== 'string') {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  const matched = presets.find(option => option === normalized);
  return (matched ?? fallback) as T[number];
};

const normalizeContentPreset = (value?: string | null): AutoContentPreset =>
  normalizePreset(value, AUTO_CONTENT_PRESETS, 'canvas');

const normalizeBoundaryPreset = (
  value: string | null | undefined,
  fallback: AutoBoundaryPreset,
): AutoBoundaryPreset => normalizePreset(value, AUTO_BOUNDARY_PRESETS, fallback);

const normalizeMaskPreset = (
  value: string | null | undefined,
  fallback: AutoMaskPreset,
): AutoMaskPreset => normalizePreset(value, AUTO_MASK_PRESETS, fallback);

const buildBoundaryUri = (
  docId: number,
  fallbackBoundaryUri: string,
  preset: AutoBoundaryPreset,
): string => {
  if (docId > 0) {
    return `uxp://boundary/${docId}/${preset}`;
  }
  return fallbackBoundaryUri;
};

const buildContentUri = (
  docId: number,
  fallbackContentUri: string,
  preset: AutoContentPreset,
): string => {
  if (docId > 0) {
    return `uxp://content/${docId}/${preset}`;
  }
  return fallbackContentUri;
};

const buildMaskUri = (
  docId: number,
  preset: AutoMaskPreset,
  options?: { hasSelection: boolean },
): string => {
  if (docId <= 0) return '';
  if (preset === 'smart_selection') {
    const target = options?.hasSelection ? 'selection' : 'canvas';
    const separator = target.includes('?') ? '&' : '?';
    return `uxp://mask/${docId}/${target}${separator}from=smart`;
  }
  return `uxp://mask/${docId}/${preset}`;
};

const BOUNDARY_SUBJECTS: Record<AutoBoundaryPreset, string> = {
  canvas: '',
  curlayer: '所选图层',
  selection: '选区',
};

const MASK_SUBJECTS: Partial<Record<AutoMaskPreset, string>> = {
  curlayer: '所选图层',
  selection: '选区',
  smart_selection: '智能选区',
};

const buildTriggerLabel = (
  contentPreset: AutoContentPreset,
  maskPreset: AutoMaskPreset,
  boundaryPreset: AutoBoundaryPreset,
): string => {
  if (
    contentPreset === 'canvas' &&
    maskPreset === 'canvas' &&
    boundaryPreset === 'canvas'
  ) {
    return '输入画布内容';
  }

  const boundarySubject = BOUNDARY_SUBJECTS[boundaryPreset];
  const maskSubject = MASK_SUBJECTS[maskPreset];
  const isSmartSelection = maskPreset === 'smart_selection';

  let base: string;

  if (contentPreset === 'canvas') {
    if (boundaryPreset !== 'canvas') {
      base = `输入边界限定在${boundarySubject}的内容`;
    } else {
      base = '输入当前画面';
    }
  } else {
    base = '输入所选图层内容';
  }

  const boundarySuffix =
    contentPreset === 'curlayer' && boundaryPreset !== 'canvas'
      ? `，边界限定在${boundarySubject}`
      : '';

  let maskSuffix = '';
  if (maskSubject) {
    const conjunction =
      contentPreset === 'canvas' && boundaryPreset === 'canvas' ? '，以' : '，并以';
    const suffixDetail = isSmartSelection ? '（无选区时回退至画布）' : '';
    maskSuffix = `${conjunction}${maskSubject}为遮罩${suffixDetail}`;
  } else if (isSmartSelection) {
    maskSuffix = '，智能选区为遮罩（无选区时回退至画布）';
  }

  return `${base}${boundarySuffix}${maskSuffix}`;
};

export interface AutoImageSelectorSourceHints {
  content?: string | null;
  mask?: string | null;
  boundary?: string | null;
}

export interface AutoImageSelectorProps
  extends Pick<
    ImageSelectorProps,
    'value' | 'workBoundary' | 'onValueChange' | 'externalErrorDismissSignal' | 'onUploadStateChange'
  > {
  sourceHints?: AutoImageSelectorSourceHints;
  label?: string | null;
}

export const AUTO_IMAGE_SELECTOR_EXTRA_OPTION = 'autoImageSelectorEnabled';

const CONTAINER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  columnGap: 12,
};

const PREVIEW_WRAPPER_STYLE: CSSProperties = {
  flex: '0 0 auto',
  width: 140,
  height: 112,
  borderRadius: 4,
  display: 'flex',
  alignItems: 'stretch',
  justifyContent: 'stretch',
  position: 'relative',
  backgroundColor: 'rgba(0, 0, 0, 0.04)',
  overflow: 'hidden',
};

const PREVIEW_PLACEHOLDER_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 12px',
  fontSize: 12,
  color: 'rgba(0, 0, 0, 0.45)',
  textAlign: 'center',
  lineHeight: 1.4,
  pointerEvents: 'none',
};

const LABEL_STYLE: CSSProperties = {
  flex: '1 1 auto',
  margin: 0,
  wordBreak: 'break-word',
};

export const AutoImageSelector: FC<AutoImageSelectorProps> = ({
  value,
  workBoundary,
  onValueChange,
  externalErrorDismissSignal,
  onUploadStateChange,
  sourceHints,
  label,
}) => {
  const t = useWidgetText();
  const normalizedValue = useMemo(() => value ?? [], [value]);
  const [previewRevision, setPreviewRevision] = useState(0);
  const [isPreviewHovered, setIsPreviewHovered] = useState(false);

  const state = useImageSelectorState({
    value: normalizedValue,
    defaultAuto: true,
    workBoundary,
  });

  const normalizedContentPreset = useMemo(
    () => normalizeContentPreset(sourceHints?.content),
    [sourceHints?.content],
  );
  const normalizedMaskPreset = useMemo(
    () => normalizeMaskPreset(sourceHints?.mask, 'smart_selection'),
    [sourceHints?.mask],
  );
  const normalizedBoundaryPreset = useMemo(
    () => normalizeBoundaryPreset(sourceHints?.boundary, 'canvas'),
    [sourceHints?.boundary],
  );

  const {
    auto,
    applyAuto,
    sourceMode,
    setSourceMode,
    boundaryUri,
    setBoundaryUri,
    contentUri,
    setContentUri,
    hasSelectionBoundary,
    maskUri,
    setMaskResource,
    setLayerInfo,
    setDiskFileResource,
    curDocId,
  } = state;

  const computed = useImageSelectorComputed({
    state,
    translate: t,
    value,
    workBoundary,
    previewRevision,
  });
  const { displayUrl, overlayDisplayUrl, debugDetails } = computed;

  const { handleSync } = useImageUploadWorkflow({
    state,
    onValueChange,
    externalErrorDismissSignal,
    onUploadStateChange,
    onPreviewInvalidate: () => {
      setPreviewRevision(prev => prev + 1);
    },
  });

  const docContext = useMemo(
    () => resolveDocContext(workBoundary, curDocId),
    [workBoundary, curDocId],
  );
  const hasInitializedSyncRef = useRef(false);

  const targetBoundaryUri = useMemo(
    () =>
      buildBoundaryUri(docContext.docId, docContext.canvasBoundaryUri, normalizedBoundaryPreset),
    [docContext.canvasBoundaryUri, docContext.docId, normalizedBoundaryPreset],
  );

  const targetContentUri = useMemo(
    () => buildContentUri(docContext.docId, docContext.canvasContentUri, normalizedContentPreset),
    [docContext.canvasContentUri, docContext.docId, normalizedContentPreset],
  );

  const targetMaskUri = useMemo(
    () =>
      buildMaskUri(docContext.docId, normalizedMaskPreset, {
        hasSelection: hasSelectionBoundary,
      }),
    [docContext.docId, normalizedMaskPreset, hasSelectionBoundary],
  );

  const triggerLabel = useMemo(
    () =>
      buildTriggerLabel(
        normalizedContentPreset,
        normalizedMaskPreset,
        normalizedBoundaryPreset,
      ),
    [normalizedBoundaryPreset, normalizedContentPreset, normalizedMaskPreset],
  );

  const localizedTriggerLabel = useMemo(
    () => t('image.auto.triggerLabel.dynamic', { defaultValue: triggerLabel, label: triggerLabel }),
    [t, triggerLabel],
  );

  const displayLabel = useMemo(() => {
    const trimmed = typeof label === 'string' ? label.trim() : '';
    return trimmed || localizedTriggerLabel;
  }, [label, localizedTriggerLabel]);

  const previewPlaceholderText = displayUrl ? null : localizedTriggerLabel;

  useEffect(() => {
    if (!auto) {
      applyAuto(true);
    }
  }, [applyAuto, auto]);

  useEffect(() => {
    if (sourceMode !== 'canvas') {
      setSourceMode('canvas');
    }
  }, [setSourceMode, sourceMode]);

  useEffect(() => {
    setLayerInfo(null);
    setDiskFileResource('', null);
  }, [docContext.docId, setDiskFileResource, setLayerInfo]);

  useEffect(() => {
    const needsBoundaryUpdate = boundaryUri !== targetBoundaryUri;
    const needsContentUpdate = contentUri !== targetContentUri;
    const needsMaskUpdate = maskUri !== targetMaskUri;

    if (needsBoundaryUpdate) {
      setBoundaryUri(targetBoundaryUri);
    }
    if (needsContentUpdate) {
      setContentUri(targetContentUri);
    }
    if (needsMaskUpdate) {
      setMaskResource(targetMaskUri);
    }

    if (!hasInitializedSyncRef.current) {
      hasInitializedSyncRef.current = true;
      return;
    }

    if (!needsBoundaryUpdate && !needsContentUpdate && !needsMaskUpdate) {
      return;
    }

    void handleSync({
      boundaryUri: targetBoundaryUri,
      contentUri: targetContentUri,
      maskUri: targetMaskUri || null,
    });
  }, [
    boundaryUri,
    contentUri,
    handleSync,
    maskUri,
    setBoundaryUri,
    setContentUri,
    setMaskResource,
    targetBoundaryUri,
    targetContentUri,
    targetMaskUri,
  ]);

  return (
    <div
      style={CONTAINER_STYLE}
      aria-label={displayLabel}
      onMouseEnter={() => setIsPreviewHovered(true)}
      onMouseLeave={() => setIsPreviewHovered(false)}
    >
      <div style={PREVIEW_WRAPPER_STYLE}>
        <PreviewPanelPresentation
          displayUrl={displayUrl}
          overlayDisplayUrl={overlayDisplayUrl}
          overlayVisible={isPreviewHovered}
          debugDetails={debugDetails}
        />
        {previewPlaceholderText ? (
          <Typography.Text type="secondary" style={PREVIEW_PLACEHOLDER_STYLE}>
            {previewPlaceholderText}
          </Typography.Text>
        ) : null}
      </div>
      <Typography.Paragraph style={LABEL_STYLE}>{displayLabel}</Typography.Paragraph>
    </div>
  );
};
