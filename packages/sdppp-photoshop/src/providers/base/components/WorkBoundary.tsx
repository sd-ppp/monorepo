import React, { useState, useEffect } from 'react';
import { Tooltip, Popover } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { useStore } from 'zustand';
import { sdpppSDK } from '@sdppp/common';
import { useTranslation } from '@sdppp/common';
import './WorkBoundary.less';

interface WorkBoundaryProps {
  className?: string;
}

export const WorkBoundary: React.FC<WorkBoundaryProps> = ({ className }) => {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const canvasStateID = useStore(sdpppSDK.stores.PhotoshopStore, (state) => state.canvasStateID);
  const selectionStateID = useStore(sdpppSDK.stores.PhotoshopStore, (state) => (state as any).selectionStateID);
  const activeDocumentID = useStore(sdpppSDK.stores.PhotoshopStore, (state) => state.activeDocumentID);
  const workBoundaries = useStore(sdpppSDK.stores.WebviewStore, (state) => state.workBoundaries);
  const workBoundaryMaxSizes = useStore(sdpppSDK.stores.WebviewStore, (state: any) => (state?.workBoundaryMaxSizes || {}));
  // Avoid selecting dynamic objects to prevent infinite update loops.

  // Get boundary name display text
  const getBoundaryName = (): string => {
    const boundary = workBoundaries[activeDocumentID];
    if (!boundary || (boundary.width >= 999999 && boundary.height >= 999999)) {
      return t('boundary.current_canvas', { defaultMessage: 'Entire Canvas' });
    }
    // Display as (leftDistance, topDistance, rightDistance, bottomDistance)
    return `(${boundary.leftDistance}, ${boundary.topDistance}, ${boundary.width}, ${boundary.height})`;
  };

  // Cleanup guides on component unmount
  useEffect(() => {
    return () => {
      // Clear guides when component unmounts
      sdpppSDK.plugins.photoshop.manageGuides({ action: "clear" }).catch(console.error);
    };
  }, []);

  const handleClick = async () => {
    try {
      // 0. 清理之前的guide
      await sdpppSDK.plugins.photoshop.manageGuides({ action: "clear" });

      // 1. 调用新的 showBoundarySelectionDialog 弹窗获取用户选择
      const result = await sdpppSDK.plugins.photoshop.showBoundarySelectionDialog({});

      if (result.cancelled) {
        return;
      }

      const { boundary, imageSize } = result as any;
      // Determine max size robustly: coerce to number; 0 or invalid -> unlimited (999999)
      const parsedSize = Number(imageSize);
      const selectedMaxSize = Number.isFinite(parsedSize) && parsedSize > 0 ? parsedSize : 999999;

      // 2. 更新当前边界类型
      const activeDocId = activeDocumentID;
      const currentBoundaries = sdpppSDK.stores.WebviewStore.getState().workBoundaries;
      // 3. 如果选择的是 curlayer 或 selection，获取具体的矩形
      if (boundary === 'curlayer' || boundary === 'selection') {
        const boundaryResult = await sdpppSDK.plugins.photoshop.getBoundary({ type: boundary } as any);

        // 4. 直接存储 BoundaryRect 数据（不需要转换）
        sdpppSDK.stores.WebviewStore.setState((prev: any) => ({
          workBoundaries: {
            ...currentBoundaries,
            [activeDocId]: boundaryResult.boundary
          },
          workBoundaryMaxSizes: {
            ...(prev?.workBoundaryMaxSizes || {}),
            [activeDocId]: selectedMaxSize
          },
          workBoundaryTypes: {
            ...(prev?.workBoundaryTypes || {}),
            [activeDocId]: boundary
          }
        }));

        // 5. 设置缩略图
        if (boundaryResult.thumbnail) {
          setThumbnailUrl(boundaryResult.thumbnail);
        }
      } else {
        sdpppSDK.stores.WebviewStore.setState((prev: any) => ({
          workBoundaries: {
            ...currentBoundaries,
            [activeDocId]: {
              leftDistance: 0,
              topDistance: 0,
              rightDistance: 0,
              bottomDistance: 0,
              width: 999999,
              height: 999999
            }
          },
          workBoundaryMaxSizes: {
            ...(prev?.workBoundaryMaxSizes || {}),
            [activeDocId]: selectedMaxSize
          },
          workBoundaryTypes: {
            ...(prev?.workBoundaryTypes || {}),
            [activeDocId]: 'canvas'
          }
        }));
        // 清除缩略图
        setThumbnailUrl(null);
      }
    } catch (error) {
      console.error('Failed to update boundary:', error);
    }
  };

  // Handle mouse enter - show guides and hover state
  const handleMouseEnter = async () => {
    setIsHovered(true);

    try {
      const boundary = workBoundaries[activeDocumentID];
      if (boundary) {
        // BoundaryRect format is already correct for guides
        await sdpppSDK.plugins.photoshop.manageGuides({
          action: "create",
          rect: boundary
        });
      }
    } catch (error) {
      console.error('Failed to create guides:', error);
    }
  };

  // Handle mouse leave - clear guides and hover state
  const handleMouseLeave = async () => {
    setIsHovered(false);

    try {
      await sdpppSDK.plugins.photoshop.manageGuides({
        action: "clear"
      });
    } catch (error) {
      console.error('Failed to clear guides:', error);
    }
  };

  // Auto-update when switching documents: reset thumbnail and guides
  useEffect(() => {
    // Clear any hover state and guides from previous document
    setIsHovered(false);
    setThumbnailUrl(null);
    sdpppSDK.plugins.photoshop.manageGuides({ action: "clear" }).catch(console.error);
    // When activeDocumentID changes, the label reads from workBoundaries[activeDocumentID]
    // so clearing thumbnail ensures text updates instead of stale preview
  }, [activeDocumentID]);

  

  // Auto-update thumbnail when selection changes and boundary type is 'selection'
  useEffect(() => {
    (async () => {
      try {
        const boundaryType = (sdpppSDK.stores.WebviewStore.getState() as any).workBoundaryTypes?.[activeDocumentID];
        if (boundaryType === 'selection') {
          const boundaryRect = sdpppSDK.stores.WebviewStore.getState().workBoundaries?.[activeDocumentID];
          if (!boundaryRect) return;
          const res = await sdpppSDK.plugins.photoshop.getImage({
            boundary: boundaryRect,
            content: 'canvas',
            imageSize: 192,
            imageQuality: 1,
            cropBySelection: 'no',
          } as any);
          let thumb = (res as any)?.thumbnail;
          if (!thumb && res?.resource) {
            try {
              const thumbRes = await (sdpppSDK.plugins.photoshop as any).getThumbnail?.({ resource: res.resource, maxSize: 192 });
              thumb = thumbRes?.thumbnail ?? thumb;
            } catch (err) {
              console.warn('[WorkBoundary] getThumbnail failed', err);
            }
          }
          if (thumb && thumb !== thumbnailUrl) {
            setThumbnailUrl(thumb);
          }
          if (typeof (res as any)?.resource === 'string') {
            try {
              await (sdpppSDK.plugins.photoshop as any)?.deleteDownloadedImage?.({ resources: [res.resource] });
            } catch (err) {
              console.warn('[WorkBoundary] deleteDownloadedImage failed', err);
            }
          }
        }
      } catch (e) {
        // ignore errors
      }
    })();
  }, [selectionStateID, activeDocumentID]);

  // Auto-update thumbnail when active layer/history changes and boundary type is 'curlayer'
  useEffect(() => {
    (async () => {
      try {
        const boundaryType = (sdpppSDK.stores.WebviewStore.getState() as any).workBoundaryTypes?.[activeDocumentID];
        if (boundaryType === 'curlayer') {
          const boundaryRect = sdpppSDK.stores.WebviewStore.getState().workBoundaries?.[activeDocumentID];
          if (!boundaryRect) return;
          const res = await sdpppSDK.plugins.photoshop.getImage({
            boundary: boundaryRect,
            content: 'canvas',
            imageSize: 192,
            imageQuality: 1,
            cropBySelection: 'no',
          } as any);
          let thumb = (res as any)?.thumbnail;
          if (!thumb && res?.resource) {
            try {
              const thumbRes = await (sdpppSDK.plugins.photoshop as any).getThumbnail?.({ resource: res.resource, maxSize: 192 });
              thumb = thumbRes?.thumbnail ?? thumb;
            } catch (err) {
              console.warn('[WorkBoundary] getThumbnail failed', err);
            }
          }
          if (thumb && thumb !== thumbnailUrl) {
            setThumbnailUrl(thumb);
          }
          if (typeof (res as any)?.resource === 'string') {
            try {
              await (sdpppSDK.plugins.photoshop as any)?.deleteDownloadedImage?.({ resources: [res.resource] });
            } catch (err) {
              console.warn('[WorkBoundary] deleteDownloadedImage failed', err);
            }
          }
        }
      } catch (e) {
        // ignore errors
      }
    })();
  }, [canvasStateID, selectionStateID, activeDocumentID]);


  return (
    <Tooltip title={t('boundary.tooltip', { defaultMessage: 'Input Setting' })}>
      <div
        className={`work-boundary ${className || ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        <div className="work-boundary-label">
          {t('boundary.title', { defaultMessage: 'Input Setting' })}
        </div>
        <div className="work-boundary-right">
          {isHovered && (
            <div className="work-boundary-edit-icon">
              <EditOutlined />
            </div>
          )} 
          {/* Current selected max size badge (placed left of boundary display) */}
          {(() => {
            const size = workBoundaryMaxSizes[activeDocumentID];
            if (!size || size === 999999) return null;
            return (
              <div className="work-boundary-size" title={t('image.limit_size')}>
                ({size}px)
              </div>
            );
          })()}

          {thumbnailUrl ? (
            <Popover
              content={
                <div className="work-boundary-large-preview">
                  <img src={thumbnailUrl} alt="Large boundary preview" />
                </div>
              }
              trigger="hover"
              placement="top"
              zIndex={9999}
              overlayStyle={{ zIndex: 9999 }}
              getPopupContainer={() => document.body}
            >
              <div className="work-boundary-thumbnail">
                <img src={thumbnailUrl} alt="Boundary thumbnail" />
              </div>
            </Popover>
          ) : (
            <div className="work-boundary-name">
              {getBoundaryName()}
            </div>
          )}


        </div>
      </div>
    </Tooltip>
  );
};
