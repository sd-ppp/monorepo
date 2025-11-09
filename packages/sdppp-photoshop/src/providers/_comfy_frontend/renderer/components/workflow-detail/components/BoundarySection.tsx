import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Tooltip, Typography, Modal, Form, InputNumber } from 'antd';
import { useTranslation } from '@sdppp/common';
import { useStore } from 'zustand';
import { sdpppSDK } from '@sdppp/common';
import {
  buildBoundaryUri,
  buildImageContentUri,
  buildMaskContentUri,
} from '../../../../../base/realtime-thumbnail/utils';
import { useThumbnail, type UseThumbnailParams } from 'sdppp-photoshop-widgets/useThumbnail';
import type { BoundarySetting } from '../../../../../base/realtime-thumbnail/types';
import { EMPTY_OBJECT } from '../constants';

const { Link } = Typography;

interface BoundarySettingsLinkProps {
  limitDisplay: string;
  qualityDisplay: string;
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  handleSubmit: () => Promise<void>;
  form: ReturnType<typeof Form.useForm>[0];
}

interface BoundaryPreviewProps {
  previewQuality: number;
}

export const BoundarySettingsLink: React.FC<BoundarySettingsLinkProps> = ({
  limitDisplay,
  qualityDisplay,
  isModalOpen,
  openModal,
  closeModal,
  handleSubmit,
  form,
}) => {
  const { t } = useTranslation();
  const translate = t as unknown as (key: string, options?: Record<string, unknown>) => string;

  return (
    <>
      <Link
        className="workflow-boundary-limit"
        onClick={openModal}
      >
        <span>{limitDisplay}</span>
        <span className="workflow-boundary-limit-value">
          {qualityDisplay}
        </span>
      </Link>
      <Modal
        open={isModalOpen}
        onCancel={closeModal}
        onOk={handleSubmit}
        okText={translate('common.save', { defaultMessage: '保存' })}
        cancelText={translate('common.cancel', { defaultMessage: '取消' })}
        title={translate('boundary.settings', { defaultMessage: '调整输入设置' })}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="maxSize"
            label={translate('boundary.max_size', { defaultMessage: '尺寸限制 (px)' })}
            rules={[
              {
                validator: (_, value) => {
                  if (value === null || value === undefined || (typeof value === 'number' && value > 0)) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error(translate('boundary.max_size_error', { defaultMessage: '请输入大于 0 的像素值' })));
                },
              },
            ]}
            tooltip={translate('boundary.max_size_hint', { defaultMessage: '留空表示不限' })}
          >
            <InputNumber
              min={1}
              precision={0}
              style={{ width: '100%' }}
              placeholder={translate('boundary.max_size_placeholder', { defaultMessage: '留空表示不限' })}
            />
          </Form.Item>
          <Form.Item
            name="imageQuality"
            label={translate('boundary.image_quality', { defaultMessage: '图像质量 (%)' })}
            rules={[
              { required: true, message: translate('boundary.image_quality_required', { defaultMessage: '请输入质量百分比' }) },
              {
                type: 'number',
                min: 1,
                max: 100,
                message: translate('boundary.image_quality_range', { defaultMessage: '范围 1-100' }),
              },
            ]}
          >
            <InputNumber
              min={1}
              max={100}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export const BoundaryPreview: React.FC<BoundaryPreviewProps> = ({ previewQuality }) => {
  const { t } = useTranslation();
  const translate = t as unknown as (key: string, options?: Record<string, unknown>) => string;
  const [isHovered, setIsHovered] = useState(false);
  const activeDocumentID = useStore(sdpppSDK.stores.PhotoshopStore, (state) => state.activeDocumentID);
  const workBoundaries = useStore(
    sdpppSDK.stores.WebviewStore,
    (state: any) => state?.workBoundaries || EMPTY_OBJECT,
  );
  const boundary = (workBoundaries as any)?.[activeDocumentID] as BoundarySetting | undefined;

  const thumbnailConfig = useMemo(() => {
    if (typeof activeDocumentID !== 'number' || !Number.isFinite(activeDocumentID)) {
      return null;
    }
    const docId = Math.max(0, Math.floor(activeDocumentID));
    const boundarySetting: BoundarySetting = boundary ?? null;
    return {
      docId,
      boundaryUri: buildBoundaryUri(docId, boundarySetting, {
        imageSize: 192,
        imageQuality: previewQuality,
      }),
      contentUri: buildImageContentUri(docId, 'canvas'),
      maskUri: buildMaskContentUri(docId, 'canvas'),
    };
  }, [activeDocumentID, boundary, previewQuality]);

  const thumbnailParams = useMemo<UseThumbnailParams>(() => {
    if (!thumbnailConfig) {
      return {
        contentUri: buildImageContentUri(0, 'canvas'),
        boundaryUri: buildBoundaryUri(0, null, {
          imageSize: 192,
          imageQuality: previewQuality,
        }),
        maskUri: buildMaskContentUri(0, 'canvas'),
      };
    }
    return {
      contentUri: thumbnailConfig.contentUri,
      boundaryUri: thumbnailConfig.boundaryUri,
      maskUri: thumbnailConfig.maskUri,
    };
  }, [thumbnailConfig, previewQuality]);

  const {
    data: previewUrl,
    isFetching: thumbnailLoading,
    error: thumbnailError,
    refetch: refetchThumbnail,
  } = useThumbnail(thumbnailParams);

  const lastBoundaryUriRef = useRef<string | null>(null);

  useEffect(() => {
    if (!thumbnailConfig) {
      lastBoundaryUriRef.current = null;
      return;
    }
    if (lastBoundaryUriRef.current === thumbnailConfig.boundaryUri) {
      return;
    }
    lastBoundaryUriRef.current = thumbnailConfig.boundaryUri;
    void refetchThumbnail().catch(error => {
      console.warn('[BoundaryPreview] refetch failed', error);
    });
  }, [thumbnailConfig, refetchThumbnail]);

  useEffect(() => {
    return () => {
      sdpppSDK.plugins.photoshop.manageGuides({ action: 'clear' }).catch(() => undefined);
    };
  }, []);

  const handleClick = useCallback(async () => {
    try {
      const result = await sdpppSDK.plugins.photoshop.getBoundary({ type: 'selection' } as any);
      if (!result || (result as any).cancelled || !(result as any).boundary) {
        return;
      }
      const nextBoundary = (result as any).boundary;
      sdpppSDK.stores.WebviewStore.setState((prev: any) => ({
        workBoundaries: {
          ...(prev?.workBoundaries ?? {}),
          [activeDocumentID]: nextBoundary,
        },
        workBoundaryTypes: {
          ...(prev?.workBoundaryTypes ?? {}),
          [activeDocumentID]: 'selection',
        },
        workBoundaryMaxSizes: {
          ...(prev?.workBoundaryMaxSizes ?? {}),
        },
        workBoundaryImageQualities: {
          ...(prev?.workBoundaryImageQualities ?? {}),
        },
      }));
      try {
        await sdpppSDK.plugins.photoshop.manageGuides({
          action: 'create',
          rect: nextBoundary,
        });
      } catch (err) {
        console.warn('Failed to create guides for boundary:', err);
      }
    } catch (error) {
      console.error('Failed to set selection boundary:', error);
    }
  }, [activeDocumentID]);

  const handleMouseEnter = useCallback(async () => {
    setIsHovered(true);
    if (!boundary) return;
    try {
      await sdpppSDK.plugins.photoshop.manageGuides({
        action: 'create',
        rect: boundary,
      });
    } catch (error) {
      console.warn('Failed to create guides on hover:', error);
    }
  }, [boundary]);

  const handleMouseLeave = useCallback(async () => {
    setIsHovered(false);
    try {
      await sdpppSDK.plugins.photoshop.manageGuides({
        action: 'clear',
      });
    } catch (error) {
      console.warn('Failed to clear guides on leave:', error);
    }
  }, []);

  const previewClassNames = [
    'workflow-boundary-preview',
    !previewUrl && 'workflow-boundary-preview-empty',
    thumbnailLoading && 'workflow-boundary-preview-loading',
    thumbnailError && !previewUrl && 'workflow-boundary-preview-error',
    isHovered && 'workflow-boundary-preview-hovered',
  ]
    .filter(Boolean)
    .join(' ');

  const labelText = isHovered
    ? translate('boundary.preview_select', { defaultMessage: 'Get selection' })
    : translate('boundary.preview_main_image', { defaultMessage: 'Main Img' });

  return (
    <Tooltip title={translate('boundary.tooltip', { defaultMessage: 'Input Setting' })}>
      <div
        className={previewClassNames}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={translate('boundary.preview_alt', { defaultMessage: 'Boundary preview' })}
          />
        ) : (
          <span className="workflow-boundary-placeholder">
            {translate('boundary.preview_placeholder', { defaultMessage: '点击使用当前选区' })}
          </span>
        )}
        <div className="workflow-boundary-preview-label">
          {labelText}
        </div>
      </div>
    </Tooltip>
  );
};
