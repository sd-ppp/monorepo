import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWidgetText, useWidgetLogger, useWorkBoundary } from '../../context/SdpppWidgetContext';
import { useDeferredUploadState } from './hooks/useDeferredUploadState';
import { SdpppWidgetDeferredUploadSelectorPresentation } from './SdpppWidgetDeferredUploadSelectorPresentation';
import { buildTriggerLabel } from './utils';
import type { SdpppWidgetDeferredUploadSelectorProps, DeferredUploadValue, DeferredUploadStatus } from './types';

/**
 * 延迟上传选择器组件
 * 
 * 特点：
 * 1. 根据 sourceHints 自动构建 URIs
 * 2. 生成预览资源（不上传）
 * 3. 将 URI 描述保存到表单
 * 4. 等待表单提交时再执行真正的上传
 * 
 * @example
 * ```tsx
 * <SdpppWidgetDeferredUploadSelector
 *   workBoundary="uxp://boundary/123/canvas"
 *   sourceHints={{
 *     content: 'canvas',
 *     boundary: 'selection',
 *     mask: 'smart_selection'
 *   }}
 *   onChange={handleChange}
 * />
 * ```
 */
export const SdpppWidgetDeferredUploadSelector: React.FC<SdpppWidgetDeferredUploadSelectorProps> = ({
  widgetableId = 'sdppp-widget-deferred-upload',
  value,
  onChange,
  onValueChange,
  workBoundary: workBoundaryProp,
  sourceHints,
  label,
  onUploadStateChange,
}) => {
  const t = useWidgetText();
  const logger = useWidgetLogger();
  // 优先使用 Context 中的 workBoundaryUri，fallback 到 prop
  const workBoundaryFromContext = useWorkBoundary();
  const workBoundary = workBoundaryFromContext || workBoundaryProp;

  const [previewResource, setPreviewResource] = useState('');
  const [status, setStatus] = useState<DeferredUploadStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasInitializedRef = useRef(false);

  // 状态管理：构建 URIs
  const state = useDeferredUploadState({
    workBoundary,
    sourceHints,
  });

  const {
    imageMaskActions,
    targetContentUri,
    targetBoundaryUri,
    targetMaskUri,
    selectionBoundary,
  } = state;

  // 生成显示标签
  const displayLabel = useMemo(() => {
    if (label && label.trim()) {
      return label.trim();
    }
    return buildTriggerLabel(sourceHints);
  }, [label, sourceHints]);

  // 更新状态并通知外部
  const updateStatus = useCallback((
    newStatus: DeferredUploadStatus,
    message: string | null = null
  ) => {
    setStatus(newStatus);
    setErrorMessage(message);
    onUploadStateChange?.({
      status: newStatus,
      errorMessage: message,
    });
  }, [onUploadStateChange]);

  // 生成预览资源（不上传）
  const generatePreview = useCallback(async () => {
    if (!targetContentUri || !targetBoundaryUri) {
      logger?.('deferred-upload: missing URIs', { targetContentUri, targetBoundaryUri });
      return;
    }

    updateStatus('generating');

    try {
      // 调用 combineByCBM 生成临时资源
      const fn = imageMaskActions['resource.file.combineByCBM'];
      if (typeof fn !== 'function') {
        throw new Error('resource.file.combineByCBM unavailable');
      }

      // 🎯 关键：如果有 maskUri，需要添加 reverse=1 参数来反转遮罩
      const maskUriWithReverse = targetMaskUri ? (() => {
        const trimmed = targetMaskUri.trim();
        if (!trimmed) return undefined;
        try {
          const parsed = new URL(trimmed);
          parsed.searchParams.set('reverse', '1');
          return parsed.toString();
        } catch {
          const separator = trimmed.includes('?') ? '&' : '?';
          return `${trimmed}${separator}reverse=1`;
        }
      })() : undefined;

      const result = await fn({
        contentUri: targetContentUri,
        boundaryUri: targetBoundaryUri,
        maskUri: maskUriWithReverse,
        thumbnail: true,
      });

      if (result?.error) {
        throw new Error(String(result.error));
      }

      const resource = typeof result?.resource === 'string' ? result.resource.trim() : '';
      if (!resource) {
        throw new Error('combineByCBM 未返回有效资源');
      }

      // 🎯 关键：需要调用 resource.thumbnail 把 resourceId 转换成可显示的 URL
      const thumbnailFn = imageMaskActions['resource.thumbnail'];
      if (typeof thumbnailFn !== 'function') {
        throw new Error('resource.thumbnail unavailable');
      }

      const thumbnailResult = await thumbnailFn({ resource });

      if (thumbnailResult?.error) {
        throw new Error(String(thumbnailResult.error));
      }

      const displayUrl = typeof thumbnailResult?.thumbnail === 'string' && thumbnailResult.thumbnail.trim()
        ? thumbnailResult.thumbnail.trim()
        : resource;  // fallback to resource ID

      setPreviewResource(displayUrl);
      updateStatus('idle');

      // 🎯 关键：保存 DeferredUploadValue 到表单（不上传）
      // 注意：maskUri 保存带 reverse=1 的版本
      const deferredValue: DeferredUploadValue = {
        type: 'deferred',
        contentUri: targetContentUri,
        boundaryUri: targetBoundaryUri,
        maskUri: maskUriWithReverse || targetMaskUri,  // 使用带 reverse=1 的版本
        resourceId: resource,
        previewUrl: displayUrl,  // 使用转换后的 URL
        timestamp: Date.now(),
      };

      console.log('[TaskRouter:DeferredUploadSelector] Emitting deferred value:', {
        deferredValue,
      });

      onChange?.(deferredValue);
      onValueChange?.(deferredValue);

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      updateStatus('error', message);
      logger?.('deferred-upload: preview generation failed', message);
    }
  }, [
    targetContentUri,
    targetBoundaryUri,
    targetMaskUri,
    imageMaskActions,
    onChange,
    onValueChange,
    updateStatus,
    logger,
  ]);

  // 当 URIs 或选区变化时，重新生成预览
  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
    }

    // 只有当 URIs 有效时才生成预览
    if (targetContentUri && targetBoundaryUri) {
      void generatePreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetContentUri, targetBoundaryUri, targetMaskUri, selectionBoundary]);

  return (
    <SdpppWidgetDeferredUploadSelectorPresentation
      displayUrl={previewResource}
      label={displayLabel}
      status={status}
      errorMessage={errorMessage}
      onPreviewClick={() => {
        // 可选：点击预览时重新生成
        void generatePreview();
      }}
    />
  );
};

SdpppWidgetDeferredUploadSelector.displayName = 'SdpppWidgetDeferredUploadSelector';
