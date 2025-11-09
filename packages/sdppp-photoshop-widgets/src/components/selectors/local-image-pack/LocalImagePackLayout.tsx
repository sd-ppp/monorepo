import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Image, Spin } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { Plus } from 'lucide-react';
import {
  computeLocalImagePackCells,
  computeLocalImagePackLayout,
  LOCAL_IMAGE_PACK_LAYOUT_CONSTANTS,
  type LocalImagePackPreviewCell,
} from '../../../utils/localImagePackLayout';
import { UploadIndicator, type UploadIndicatorStatus } from '../../shared/UploadIndicator';

const {
  WRAPPER_GAP,
  GRID_GAP,
  RIGHT_PADDING,
  LEFT_MIN_WIDTH,
  TRASH_BUTTON_HEIGHT,
} = LOCAL_IMAGE_PACK_LAYOUT_CONSTANTS;

const BORDER_COLOR = 'var(--sdppp-widget-border-color, var(--ant-color-border, #d9d9d9))';
const BORDER_STYLE = `1px solid ${BORDER_COLOR}`;
const BORDER_RADIUS_VALUE = 'var(--sdppp-widget-border-radius, 4px)';
const BORDER_RADIUS = BORDER_RADIUS_VALUE;

export interface LocalImagePackLayoutProps {
  widgetableId: string;
  items: LocalImagePackPreviewCell[];
  buttonLabel: string;
  emptyLabel: string;
  uploadStatus?: UploadIndicatorStatus;
  uploadErrorMessage?: React.ReactNode;
  onUploadRetry?: () => void;
  onUploadDismiss?: () => void;
  uploadProgress?: { current: number; total: number };
  onAdd: () => void;
  onClear: () => void;
}

export const LocalImagePackLayout: React.FC<LocalImagePackLayoutProps> = ({
  widgetableId,
  items,
  buttonLabel,
  emptyLabel,
  uploadStatus = 'idle',
  uploadErrorMessage,
  onUploadRetry,
  onUploadDismiss,
  uploadProgress,
  onAdd,
  onClear,
}) => {
  const totalItems = items.length;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const rightContainerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [rightWidth, setRightWidth] = useState(0);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const node = rootRef.current;
    if (!node) return;
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width ?? 0;
      setContainerWidth(prev => {
        if (Math.abs(prev - width) < 0.5) return prev;
        return width;
      });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const element = rightContainerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setRightWidth(prev => {
        if (Math.abs(prev - rect.width) < 0.5) return prev;
        return rect.width;
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const layout = useMemo(
    () =>
      computeLocalImagePackLayout({
        imageCount: totalItems,
        containerWidth,
        rightWidth,
      }),
    [totalItems, containerWidth, rightWidth],
  );

  const cellsToRender = useMemo(
    () => computeLocalImagePackCells(items, layout),
    [items, layout],
  );

  const hasImages = totalItems > 0;
  const addIconSize = Math.max(16, Math.min(40, layout.tileSize * 0.35));

  const mainLayout = (
    <div
      ref={rootRef}
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: WRAPPER_GAP,
        width: '100%',
      }}
    >
      <div
        style={{
          flex: '0 0 auto',
          width: layout.leftWidth,
          minWidth: LEFT_MIN_WIDTH,
          display: 'flex',
          flexDirection: 'column',
          height: layout.panelHeight,
        }}
      >
        <Button
          type="default"
          block
          icon={<Plus size={addIconSize} strokeWidth={2} />}
          style={{
            height: layout.addButtonHeight,
            minHeight: layout.addButtonHeight,
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: BORDER_STYLE,
            borderColor: BORDER_COLOR,
            borderRadius: hasImages
              ? `${BORDER_RADIUS_VALUE} ${BORDER_RADIUS_VALUE} 0 0`
              : BORDER_RADIUS_VALUE,
          }}
          aria-label={buttonLabel}
          title={buttonLabel}
          onClick={onAdd}
        />
        {hasImages ? (
          <Button
            block
            type="default"
            icon={<DeleteOutlined />}
            style={{
              height: TRASH_BUTTON_HEIGHT,
              lineHeight: `${TRASH_BUTTON_HEIGHT}px`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              border: BORDER_STYLE,
              borderColor: BORDER_COLOR,
              borderTop: 'none',
              borderRadius: `0 0 ${BORDER_RADIUS_VALUE} ${BORDER_RADIUS_VALUE}`,
            }}
            onClick={onClear}
          />
        ) : null}
      </div>
      <div
        ref={rightContainerRef}
        style={{
          flex: '1 1 0%',
          position: 'relative',
          boxSizing: 'border-box',
          padding: RIGHT_PADDING,
          overflowY: layout.needsScroll ? 'auto' : 'hidden',
          overflowX: 'hidden',
          height: layout.panelHeight,
          maxHeight: layout.panelHeight,
          border: BORDER_STYLE,
          borderRadius: BORDER_RADIUS,
          backgroundColor: '#fff',
        }}
      >
        {cellsToRender.length === 0 ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(0,0,0,0.45)',
              fontSize: 12,
            }}
          >
            {emptyLabel}
          </div>
        ) : (
          <Image.PreviewGroup>
            <div
              style={{
                display: 'grid',
                width: '100%',
                height: '100%',
                gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
                gap: GRID_GAP,
                gridAutoRows: `${layout.tileSize}px`,
                alignContent: 'start',
              }}
            >
              {cellsToRender.map(cell => {
                const hasImage = Boolean(cell.url);
                return (
                  <div
                    key={cell.id}
                    style={{
                      width: '100%',
                      aspectRatio: '1 / 1',
                      borderRadius: BORDER_RADIUS_VALUE,
                      overflow: 'hidden',
                      backgroundColor: '#fff',
                      border: hasImage ? `1px solid ${BORDER_COLOR}` : '1px dashed rgba(0,0,0,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 4,
                      position: 'relative',
                    }}
                  >
                    {hasImage ? (
                      <Image
                        src={cell.url}
                        alt=""
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                          flex: '1 1 auto',
                          display: 'block',
                          filter: cell.status === 'pending' ? 'grayscale(0.85)' : undefined,
                          opacity: cell.status === 'pending' ? 0.5 : 1,
                        }}
                      />
                    ) : null}
                    {cell.status === 'pending' ? (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 4,
                          background: 'rgba(255,255,255,0.65)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 'calc(var(--sdppp-widget-border-radius, 4px) / 2)',
                        }}
                      >
                        <Spin size="small" />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Image.PreviewGroup>
        )}
      </div>
    </div>
  );

  return (
    <div
      data-widgetable-id={widgetableId}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        width: '100%',
      }}
    >
      {mainLayout}
      <UploadIndicator
        status={uploadStatus}
        errorMessage={uploadErrorMessage}
        onRetry={onUploadRetry}
        onDismiss={onUploadDismiss}
        progressCurrent={uploadProgress?.current}
        progressTotal={uploadProgress?.total}
        containerStyle={{
          position: 'static',
          width: '100%',
        }}
      />
    </div>
  );
};
