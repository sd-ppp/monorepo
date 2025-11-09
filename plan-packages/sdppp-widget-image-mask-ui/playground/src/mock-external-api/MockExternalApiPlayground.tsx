import React, { useCallback, useMemo } from 'react';

import { CANVAS_DIMENSIONS, SimulationCanvas } from './SimulationCanvas';
import { ImageUrlsPanel } from './ImageUrlsPanel';
import type { MockExternalApiPlaygroundProps } from './types';

export const MockExternalApiPlayground: React.FC<MockExternalApiPlaygroundProps> = ({
  children,
  stageRef,
  selectionRect,
  updateSelectionRect,
  notifyContentChange,
  imageUrls,
  onImageUrlsChange,
  onRunUploadPasses,
  registeredUploadPassCount,
  lastUploadRunSummary,
}) => {
  const normalizedImageUrls = useMemo(() => {
    if (!Array.isArray(imageUrls)) return [];
    return imageUrls.map(item => (typeof item === 'string' ? item : item != null ? String(item) : ''));
  }, [imageUrls]);

  const handleImageUrlReplace = useCallback(
    (index: number, nextUrl: string) => {
      if (!Array.isArray(imageUrls) || !onImageUrlsChange) return;
      if (index < 0 || index >= normalizedImageUrls.length) return;
      if (normalizedImageUrls[index] === nextUrl) return;
      const next = normalizedImageUrls.map((item, idx) => (idx === index ? nextUrl : item));
      onImageUrlsChange(next);
    },
    [imageUrls, normalizedImageUrls, onImageUrlsChange]
  );

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        gap: 24,
        padding: 24,
        boxSizing: 'border-box',
        width: '100%',
        minHeight: CANVAS_DIMENSIONS.height + 48,
      }}
    >
      <div
        style={{
          width: 320,
          maxWidth: 320,
          flex: '0 0 auto',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div>{children}</div>
        <ImageUrlsPanel
          imageUrls={normalizedImageUrls}
          canEdit={Array.isArray(imageUrls) && typeof onImageUrlsChange === 'function'}
          onReplace={handleImageUrlReplace}
          onRunUploadPasses={onRunUploadPasses}
          registeredUploadPassCount={registeredUploadPassCount}
          lastRunSummary={lastUploadRunSummary}
        />
      </div>
      <div
        style={{
          flex: '0 0 auto',
        }}
      >
        <SimulationCanvas
          stageRef={stageRef}
          selectionRect={selectionRect}
          updateSelectionRect={updateSelectionRect}
          notifyContentChange={notifyContentChange}
        />
      </div>
    </div>
  );
};

