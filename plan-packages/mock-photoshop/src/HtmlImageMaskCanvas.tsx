import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Rect, RegularPolygon, Star, Circle, Text as KonvaText } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Stage as KonvaStage } from 'konva/lib/Stage';
import type { MutableRefObject } from 'react';

import { generateShapes } from './shapes';
import type { SelectionRect, ShapeDefinition } from './types';

const STAGE_WIDTH = 480;
const STAGE_HEIGHT = 400;
const SHAPE_COUNT = 12;
const BACKGROUND_COLORS = ['#f5f7fb', '#e0e7f5'];
const THUMBNAIL_WIDTH = 120;
const THUMBNAIL_HEIGHT = Math.round((STAGE_HEIGHT / STAGE_WIDTH) * THUMBNAIL_WIDTH);

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const toRect = (start: { x: number; y: number }, current: { x: number; y: number }): SelectionRect => {
  const x = Math.min(start.x, current.x);
  const y = Math.min(start.y, current.y);
  const width = Math.abs(current.x - start.x);
  const height = Math.abs(current.y - start.y);
  return { x, y, width, height };
};

export interface HtmlImageMaskCanvasProps {
  shapes?: ShapeDefinition[];
  stageRef?: MutableRefObject<KonvaStage | null>;
  selectionRect?: SelectionRect | null;
  onSelectionChange?: (rect: SelectionRect | null) => void;
  selectedLayerId?: string | null;
  onLayerSelect?: (layerId: string) => void;
  onShuffleShapes?: () => void;
}

export const HtmlImageMaskCanvas: React.FC<HtmlImageMaskCanvasProps> = ({
  shapes: providedShapes,
  stageRef,
  selectionRect: selectionRectProp,
  onSelectionChange,
  selectedLayerId: selectedLayerIdProp,
  onLayerSelect,
  onShuffleShapes,
}) => {
  const isShapesControlled = typeof providedShapes !== 'undefined';
  const [internalShapes, setInternalShapes] = useState<ShapeDefinition[]>(() =>
    providedShapes ?? generateShapes(SHAPE_COUNT, STAGE_WIDTH, STAGE_HEIGHT)
  );

  useEffect(() => {
    if (isShapesControlled && providedShapes) {
      setInternalShapes(providedShapes);
    }
  }, [isShapesControlled, providedShapes]);

  const shapes = isShapesControlled && providedShapes ? providedShapes : internalShapes;

  const orderedShapes = useMemo(() => [...shapes].reverse(), [shapes]);

  const [internalSelection, setInternalSelection] = useState<SelectionRect | null>(null);
  const [previewRect, setPreviewRect] = useState<SelectionRect | null>(null);
  const isSelectionControlled = typeof selectionRectProp !== 'undefined';
  const selectionRect = isSelectionControlled ? selectionRectProp ?? null : internalSelection;

  const [internalSelectedLayer, setInternalSelectedLayer] = useState<string | null>(orderedShapes[0]?.id ?? null);
  const isLayerControlled = typeof selectedLayerIdProp !== 'undefined';
  const selectedLayerId = isLayerControlled ? selectedLayerIdProp ?? null : internalSelectedLayer;

  useEffect(() => {
    if (!isLayerControlled) {
      setInternalSelectedLayer(current => {
        if (!current || !orderedShapes.some(shape => shape.id === current)) {
          return orderedShapes[0]?.id ?? null;
        }
        return current;
      });
    }
  }, [isLayerControlled, orderedShapes]);

  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(
    () => () => {
      pointerStartRef.current = null;
      if (stageRef) {
        stageRef.current = null;
      }
    },
    [stageRef]
  );

  const activeRect = previewRect ?? selectionRect;

  const getPointerPosition = useCallback(
    (evt: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>) => {
      const stage = evt.target.getStage();
      const pointer = stage?.getPointerPosition();
      if (!stage || !pointer) return null;
      return {
        x: clamp(pointer.x, 0, stage.width()),
        y: clamp(pointer.y, 0, stage.height()),
      };
    },
    []
  );

  const commitSelection = useCallback(
    (rect: SelectionRect | null) => {
      const next = rect && rect.width >= 4 && rect.height >= 4 ? rect : null;
      if (!isSelectionControlled) {
        setInternalSelection(next);
      }
      setPreviewRect(null);
      onSelectionChange?.(next);
    },
    [isSelectionControlled, onSelectionChange]
  );

  const handlePointerDown = useCallback(
    (evt: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>) => {
      evt.evt.preventDefault();
      const point = getPointerPosition(evt);
      if (!point) return;
      pointerStartRef.current = point;
      setPreviewRect({ x: point.x, y: point.y, width: 0, height: 0 });
    },
    [getPointerPosition]
  );

  const handlePointerMove = useCallback(
    (evt: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>) => {
      if (!pointerStartRef.current) return;
      evt.evt.preventDefault();
      const point = getPointerPosition(evt);
      if (!point) return;
      setPreviewRect(toRect(pointerStartRef.current, point));
    },
    [getPointerPosition]
  );

  const handlePointerUp = useCallback(
    (evt: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>) => {
      if (!pointerStartRef.current) return;
      evt.evt.preventDefault();
      pointerStartRef.current = null;
      commitSelection(previewRect);
    },
    [commitSelection, previewRect]
  );

  const handleLayerSelect = useCallback((shapeId: string) => {
    onLayerSelect?.(shapeId);
    if (!isLayerControlled) {
      setInternalSelectedLayer(shapeId);
    }
  }, [isLayerControlled, onLayerSelect]);
  const handleShuffle = useCallback(() => {
    if (isShapesControlled) {
      onShuffleShapes?.();
    } else {
      const nextShapes = generateShapes(SHAPE_COUNT, STAGE_WIDTH, STAGE_HEIGHT);
      setInternalShapes(nextShapes);
      if (!isLayerControlled) {
        setInternalSelectedLayer(nextShapes[nextShapes.length - 1]?.id ?? null);
      }
    }
    if (!isSelectionControlled) {
      setInternalSelection(null);
    }
    setPreviewRect(null);
    pointerStartRef.current = null;
    onSelectionChange?.(null);
  }, [isLayerControlled, isSelectionControlled, isShapesControlled, onLayerSelect, onSelectionChange, onShuffleShapes]);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
      <div
        style={{
          width: STAGE_WIDTH,
          height: STAGE_HEIGHT,
          borderRadius: 20,
          boxShadow: '0 18px 42px rgba(34, 56, 112, 0.14)',
          overflow: 'hidden',
          flex: '0 0 auto',
          background: '#fff',
        }}
      >
        <Stage
          width={STAGE_WIDTH}
          height={STAGE_HEIGHT}
          ref={node => {
            if (stageRef) {
              stageRef.current = node;
            }
          }}
          onMouseDown={handlePointerDown}
          onTouchStart={handlePointerDown}
          onMouseMove={handlePointerMove}
          onTouchMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onTouchEnd={handlePointerUp}
          onMouseLeave={handlePointerUp}
        >
          <Layer>
            <Rect
              x={0}
              y={0}
              width={STAGE_WIDTH}
              height={STAGE_HEIGHT}
              fillLinearGradientStartPoint={{ x: 0, y: 0 }}
              fillLinearGradientEndPoint={{ x: STAGE_WIDTH, y: STAGE_HEIGHT }}
              fillLinearGradientColorStops={[0, BACKGROUND_COLORS[0], 1, BACKGROUND_COLORS[1]]}
            />
            {shapes.map(shape => {
              const baseProps = {
                key: shape.id,
                x: shape.x,
                y: shape.y,
                rotation: shape.rotation,
                fill: shape.fill,
                opacity: shape.opacity,
                stroke: shape.stroke,
                strokeWidth: 2,
                shadowBlur: 10,
                shadowColor: 'rgba(30, 60, 90, 0.15)',
              };
              switch (shape.kind) {
                case 'circle':
                  return <Circle {...baseProps} radius={shape.size / 2} />;
                case 'triangle':
                  return <RegularPolygon {...baseProps} sides={3} radius={shape.size / 2} />;
                case 'star':
                  return <Star {...baseProps} numPoints={5} innerRadius={shape.size / 4} outerRadius={shape.size / 2} />;
                default:
                  return (
                    <Rect
                      {...baseProps}
                      width={shape.size}
                      height={shape.size}
                      offset={{ x: shape.size / 2, y: shape.size / 2 }}
                    />
                  );
              }
            })}
            {activeRect ? (
              <>
                <Rect
                  name="selection-overlay"
                  x={activeRect.x}
                  y={activeRect.y}
                  width={activeRect.width}
                  height={activeRect.height}
                  fill="rgba(62, 124, 240, 0.15)"
                  stroke="rgba(62, 124, 240, 0.65)"
                  strokeWidth={2}
                  dash={[8, 6]}
                  cornerRadius={6}
                />
                <KonvaText
                  name="selection-overlay"
                  x={activeRect.x}
                  y={Math.max(0, activeRect.y - 24)}
                  text={`${Math.round(activeRect.width)} × ${Math.round(activeRect.height)}`}
                  fontSize={16}
                  fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                  fill="rgba(27, 43, 82, 0.85)"
                  padding={5}
                />
              </>
            ) : null}
          </Layer>
        </Stage>
      </div>
      <div
        style={{
          width: 220,
          maxHeight: STAGE_HEIGHT,
          flex: '0 0 220px',
          borderRadius: 18,
          background: '#ffffff',
          boxShadow: '0 16px 36px rgba(34, 56, 112, 0.12)',
          padding: 14,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 16,
            fontWeight: 600,
            color: 'rgba(22, 36, 68, 0.92)',
            fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          }}
        >
          图层
          <button
            type="button"
            onClick={handleShuffle}
            title="随机刷新画布"
            style={{
              border: 'none',
              background: 'rgba(62, 124, 240, 0.12)',
              color: '#3e7cf0',
              width: 28,
              height: 28,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.2s ease',
            }}
          >
            🎲
          </button>
        </div>
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
            paddingRight: 2,
          }}
        >
          {orderedShapes.map((shape, index) => {
            const isSelected = shape.id === selectedLayerId;
            const friendlyKind = shape.kind.charAt(0).toUpperCase() + shape.kind.slice(1);
            return (
              <button
                key={shape.id}
                type="button"
                onClick={() => handleLayerSelect(shape.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  border: isSelected ? '2px solid rgba(62, 124, 240, 0.9)' : '1px solid rgba(40, 60, 110, 0.12)',
                  background: isSelected ? 'rgba(62, 124, 240, 0.07)' : '#ffffff',
                  padding: '6px 10px',
                  borderRadius: 12,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isSelected ? '0 6px 14px rgba(62, 124, 240, 0.18)' : '0 1px 4px rgba(24, 40, 78, 0.12)',
                  textAlign: 'left',
                  borderBottom: index === orderedShapes.length - 1 ? 'none' : '1px solid rgba(40, 60, 110, 0.08)',
                }}
              >
                <LayerThumbnail shape={shape} isSelected={isSelected} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: isSelected ? 'rgba(31, 67, 140, 0.95)' : 'rgba(26, 44, 82, 0.9)',
                      fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                    }}
                  >
                    Layer {index + 1}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: 'rgba(36, 60, 110, 0.7)',
                      fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                    }}
                  >
                    {friendlyKind}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const LayerThumbnail: React.FC<{ shape: ShapeDefinition; isSelected: boolean }> = ({ shape, isSelected }) => {
  const scale = THUMBNAIL_WIDTH / STAGE_WIDTH;
  const commonProps = {
    x: shape.x * scale,
    y: shape.y * scale,
    rotation: shape.rotation,
    fill: shape.fill,
    opacity: shape.opacity,
    stroke: shape.stroke,
    strokeWidth: 2 * scale,
    shadowBlur: 6 * scale,
    shadowColor: 'rgba(30, 60, 90, 0.12)',
  };

  return (
    <div
      style={{
        width: THUMBNAIL_WIDTH,
        height: THUMBNAIL_HEIGHT,
        borderRadius: 12,
        overflow: 'hidden',
        flex: '0 0 auto',
        position: 'relative',
      }}
    >
      <Stage width={THUMBNAIL_WIDTH} height={THUMBNAIL_HEIGHT}>
        <Layer>
          <Rect
            x={0}
            y={0}
            width={THUMBNAIL_WIDTH}
            height={THUMBNAIL_HEIGHT}
            fillLinearGradientStartPoint={{ x: 0, y: 0 }}
            fillLinearGradientEndPoint={{ x: THUMBNAIL_WIDTH, y: THUMBNAIL_HEIGHT }}
            fillLinearGradientColorStops={[0, BACKGROUND_COLORS[0], 1, BACKGROUND_COLORS[1]]}
          />
          {(() => {
            switch (shape.kind) {
              case 'circle':
                return <Circle {...commonProps} radius={(shape.size / 2) * scale} />;
              case 'triangle':
                return <RegularPolygon {...commonProps} sides={3} radius={(shape.size / 2) * scale} />;
              case 'star':
                return (
                  <Star
                    {...commonProps}
                    numPoints={5}
                    innerRadius={(shape.size / 4) * scale}
                    outerRadius={(shape.size / 2) * scale}
                  />
                );
              default:
                return (
                  <Rect
                    {...commonProps}
                    width={shape.size * scale}
                    height={shape.size * scale}
                    offset={{ x: (shape.size * scale) / 2, y: (shape.size * scale) / 2 }}
                  />
                );
            }
          })()}
        </Layer>
      </Stage>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 12,
          border: isSelected ? '2px solid rgba(62, 124, 240, 0.9)' : '1px solid rgba(40, 60, 110, 0.15)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};
