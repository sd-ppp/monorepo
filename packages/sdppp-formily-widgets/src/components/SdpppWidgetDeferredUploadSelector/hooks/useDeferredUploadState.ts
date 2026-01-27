import { useMemo } from 'react';
import type { DeferredUploadSelectorSourceHints } from '../types';
import { buildContentUri, buildBoundaryUri, buildMaskUri, parseDocIdFromWorkBoundary } from '../utils';
import { useImageSelectorState } from '../../ImageSelector/hooks/useImageSelectorState';

export interface UseDeferredUploadStateParams {
  workBoundary: string;
  sourceHints?: DeferredUploadSelectorSourceHints;
}

/**
 * 延迟上传选择器的状态管理 Hook
 * 
 * 负责：
 * 1. 解析 workBoundary 获取 docId
 * 2. 根据 sourceHints 构建目标 URIs
 * 3. 复用 ImageSelector 的状态管理
 */
export const useDeferredUploadState = ({
  workBoundary,
  sourceHints,
}: UseDeferredUploadStateParams) => {
  // 复用 ImageSelector 的状态管理（获取 actions、selectionBoundary 等）
  const imageSelectorState = useImageSelectorState({
    value: [],
    defaultAuto: true,
    workBoundary,
  });

  const { hasSelectionBoundary, curDocId, selectionBoundary } = imageSelectorState;

  // 解析文档上下文
  const docContext = useMemo(() => {
    const docId = parseDocIdFromWorkBoundary(workBoundary);
    return {
      docId,
      canvasBoundaryUri: `uxp://boundary/${docId}/canvas`,
      canvasContentUri: `uxp://content/${docId}/canvas`,
    };
  }, [workBoundary]);

  // 根据 sourceHints 构建目标 URIs
  const targetContentUri = useMemo(
    () => buildContentUri(docContext.docId, sourceHints?.content),
    [docContext.docId, sourceHints?.content]
  );

  const targetBoundaryUri = useMemo(
    () => buildBoundaryUri(
      docContext.docId,
      docContext.canvasBoundaryUri,
      sourceHints?.boundary
    ),
    [docContext.docId, docContext.canvasBoundaryUri, sourceHints?.boundary]
  );

  const targetMaskUri = useMemo(
    () => {
      const mask = sourceHints?.mask;
      // 如果是 empty 或 null，不依赖 hasSelectionBoundary
      if (mask === 'empty' || mask === null) {
        return buildMaskUri(docContext.docId, mask, false);
      }
      // 其他情况才依赖 hasSelectionBoundary
      return buildMaskUri(docContext.docId, mask, hasSelectionBoundary);
    },
    // 只有当 mask 是 smart_selection 时才依赖 hasSelectionBoundary
    sourceHints?.mask === 'empty' || sourceHints?.mask === null
      ? [docContext.docId, sourceHints?.mask]
      : [docContext.docId, sourceHints?.mask, hasSelectionBoundary]
  );

  return {
    ...imageSelectorState,
    docContext,
    targetContentUri,
    targetBoundaryUri,
    targetMaskUri,
  };
};
