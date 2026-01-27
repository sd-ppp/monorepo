import { useCallback, useMemo, useState } from 'react';
import { Form } from 'antd';
import { useStore } from 'zustand';
import { useTranslation } from '@sdppp/common';
import { sdpppSDK } from '@sdppp/common';
import { EMPTY_OBJECT } from '../constants';

export interface BoundarySettingsState {
  limitDisplay: string;
  qualityDisplay: string;
  previewQuality: number;
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  handleSubmit: () => Promise<void>;
  form: ReturnType<typeof Form.useForm>[0];
  activeDocumentID?: number;
}

export const useBoundarySettings = (): BoundarySettingsState => {
  const { t } = useTranslation();
  const translate = t as unknown as (key: string, options?: Record<string, unknown>) => string;
  const [form] = Form.useForm();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const activeDocumentID = useStore(sdpppSDK.stores.PhotoshopStore, (state) => state.activeDocumentID);
  const workBoundaryMaxSizes = useStore(
    sdpppSDK.stores.WebviewStore,
    (state: any) => state?.workBoundaryMaxSizes || EMPTY_OBJECT,
  );
  const workBoundaryImageQualities = useStore(
    sdpppSDK.stores.WebviewStore,
    (state: any) => state?.workBoundaryImageQualities || EMPTY_OBJECT,
  );

  const rawMaxSize = (workBoundaryMaxSizes as any)?.[activeDocumentID];
  const rawQuality = (workBoundaryImageQualities as any)?.[activeDocumentID];

  const normalizedMaxSize = useMemo(() => {
    if (typeof rawMaxSize === 'number' && Number.isFinite(rawMaxSize) && rawMaxSize > 0) {
      return Math.round(rawMaxSize);
    }
    return 999999;
  }, [rawMaxSize]);

  const normalizedQualityPercent = useMemo(() => {
    if (typeof rawQuality === 'number' && Number.isFinite(rawQuality)) {
      return Math.min(Math.max(Math.round(rawQuality), 1), 100);
    }
    return 100;
  }, [rawQuality]);

  const limitDisplay = useMemo(() => {
    if (normalizedMaxSize >= 999999) {
      return translate('boundary.no_limit', { defaultMessage: '不限' });
    }
    return `${normalizedMaxSize}px`;
  }, [normalizedMaxSize, translate]);

  const qualityDisplay = useMemo(() => `${normalizedQualityPercent}%`, [normalizedQualityPercent]);
  const previewQuality = useMemo(() => normalizedQualityPercent / 100, [normalizedQualityPercent]);

  const openModal = useCallback(() => {
    if (!activeDocumentID) {
      return;
    }
    form.setFieldsValue({
      maxSize: normalizedMaxSize >= 999999 ? null : normalizedMaxSize,
      imageQuality: normalizedQualityPercent,
    });
    setIsModalOpen(true);
  }, [activeDocumentID, form, normalizedMaxSize, normalizedQualityPercent]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!activeDocumentID) {
      setIsModalOpen(false);
      return;
    }
    const values = await form.validateFields();
    const rawSize = Number(values.maxSize);
    const rawPercent = Number(values.imageQuality);
    const nextSize = Number.isFinite(rawSize) && rawSize > 0 ? Math.round(rawSize) : 999999;
    const nextQuality = Number.isFinite(rawPercent)
      ? Math.min(Math.max(Math.round(rawPercent), 1), 100)
      : 100;

    sdpppSDK.stores.WebviewStore.setState((prev: any) => ({
      workBoundaryMaxSizes: {
        ...(prev?.workBoundaryMaxSizes ?? {}),
        [activeDocumentID]: nextSize,
      },
      workBoundaryImageQualities: {
        ...(prev?.workBoundaryImageQualities ?? {}),
        [activeDocumentID]: nextQuality,
      },
    }));
    setIsModalOpen(false);
  }, [activeDocumentID, form]);

  return {
    limitDisplay,
    qualityDisplay,
    previewQuality,
    isModalOpen,
    openModal,
    closeModal,
    handleSubmit,
    form,
    activeDocumentID,
  };
};
