import React, { useCallback, useEffect, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { Stage as KonvaStage } from 'konva/lib/Stage';

import {
  HtmlImageMaskCanvas,
  generateShapes,
  type ShapeDefinition,
} from '@sdppp/mock-photoshop';

import type { SelectionRect, MockRealtimeContent } from './types';

export const CANVAS_DIMENSIONS = {
  width: 480,
  height: 400,
};

const SHAPE_COUNT = 12;

interface SimulationCanvasProps {
  stageRef: MutableRefObject<KonvaStage | null>;
  selectionRect: SelectionRect | null;
  updateSelectionRect: (rect: SelectionRect | null) => void;
  notifyContentChange: (content: MockRealtimeContent) => void;
  onLayerIdChange?: (layerId: string | null) => void;
  boundaryPreviewRect?: SelectionRect | null;
}

export const SimulationCanvas: React.FC<SimulationCanvasProps> = ({
  stageRef,
  selectionRect,
  updateSelectionRect,
  notifyContentChange,
  onLayerIdChange,
  boundaryPreviewRect,
}) => {
  const [shapes, setShapes] = useState<ShapeDefinition[]>(() =>
    generateShapes(SHAPE_COUNT, CANVAS_DIMENSIONS.width, CANVAS_DIMENSIONS.height)
  );
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(shapes[shapes.length - 1]?.id ?? null);

  useEffect(() => {
    setSelectedLayerId(current => {
      if (current && shapes.some(shape => shape.id === current)) {
        return current;
      }
      return shapes[shapes.length - 1]?.id ?? null;
    });
  }, [shapes]);

  useEffect(() => {
    onLayerIdChange?.(selectedLayerId);
  }, [onLayerIdChange, selectedLayerId]);

  const handleSelectionChange = useCallback(
    (rect: Parameters<typeof updateSelectionRect>[0]) => {
      updateSelectionRect(rect);
    },
    [updateSelectionRect]
  );

  const handleLayerSelect = useCallback((layerId: string) => {
    setSelectedLayerId(layerId);
    notifyContentChange('curlayer');
  }, [notifyContentChange]);

  const handleShuffleShapes = useCallback(() => {
    setShapes(generateShapes(SHAPE_COUNT, CANVAS_DIMENSIONS.width, CANVAS_DIMENSIONS.height));
    updateSelectionRect(null);
    notifyContentChange('canvas');
  }, [notifyContentChange, updateSelectionRect]);

  return (
    <HtmlImageMaskCanvas
      shapes={shapes}
      stageRef={stageRef}
      selectionRect={selectionRect}
      onSelectionChange={handleSelectionChange}
      selectedLayerId={selectedLayerId}
      onLayerSelect={handleLayerSelect}
      onShuffleShapes={handleShuffleShapes}
      boundaryPreviewRect={boundaryPreviewRect}
    />
  );
};
