import {
  BoxSelect,
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  Minimize2,
  MoreVertical,
  Save,
  Send,
  StepForward,
  Trash2,
} from 'lucide-react';
import { sdpppSDK, useTranslation } from '@sdppp/common';
import { SwitchButton } from '@sdppp/ui-library';
import { Button, Divider, Dropdown, Tooltip } from 'antd';
import React from 'react';
import { isImage } from '../../utils/fileType';
import { MainStore } from '../App.store';
import ImagePreview from './ImagePreview';

interface ImagePreviewWrapperProps {
  children?: React.ReactNode;
}

type SendMode = 'smartobject' | 'newdoc' | 'selection';

export default function ImagePreviewWrapper({ children }: ImagePreviewWrapperProps) {
  const { t } = useTranslation();
  const images = MainStore(state => state.previewImageList);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [sending, setSending] = React.useState(false);
  const [sendingAll, setSendingAll] = React.useState(false);
  const [autoMode, setAutoMode] = React.useState<SendMode | null>(null);
  const autoModeRef = React.useRef<SendMode | null>(null);
  const pendingAutoSendRef = React.useRef(new Map<string, { cancel: boolean }>());

  React.useEffect(() => {
    autoModeRef.current = autoMode;
  }, [autoMode]);

  const saveResources = React.useCallback(async (resources: string[]) => {
    if (!resources.length) {
      return;
    }
    const photoshop = (sdpppSDK?.plugins?.photoshop ?? {}) as Record<string, any>;
    const saveAction = photoshop?.fileResource?.saveAs;
    if (typeof saveAction !== 'function') {
      console.warn('[ImagePreviewWrapper] fileResource.saveAs not available');
      return;
    }
    const result = await saveAction.call(photoshop, { resources });
    if (result?.error && result.error !== 'cancelled') {
      console.warn('[ImagePreviewWrapper] saveAs failed', result.error);
    }
  }, []);

  const normalizedIndex = React.useMemo(() => {
    if (!images.length) {
      return 0;
    }
    return Math.min(currentIndex, images.length - 1);
  }, [currentIndex, images.length]);

  React.useEffect(() => {
    if (currentIndex !== normalizedIndex) {
      setCurrentIndex(normalizedIndex);
    }
  }, [currentIndex, normalizedIndex]);

  const buildSelectionBoundaryUri = (docId?: number | null) => {
    return typeof docId === 'number' && Number.isFinite(docId) && docId > 0
      ? `uxp://boundary/${docId}/selection`
      : undefined;
  };

  const currentItem = images[normalizedIndex];
  const isCurrentItemImage = currentItem ? isImage(currentItem.url) : false;
  const ICON_SIZE = 16;
  const SWITCH_BUTTON_SIZE = 32;
  const selectionBoundaryUri = buildSelectionBoundaryUri(currentItem?.docId);

  const resolveSendParams = (
    image: (typeof images)[number] | undefined,
    mode: SendMode
  ): { type: 'smartobject' | 'newdoc'; boundaryUri?: string } | null => {
    if (!image) {
      return null;
    }
    const type = mode === 'newdoc' ? 'newdoc' : 'smartobject';
    if (mode === 'selection') {
      const boundaryUri = buildSelectionBoundaryUri(image.docId ?? null);
      if (!boundaryUri) {
        return null;
      }
      return { type, boundaryUri };
    }
    return { type, boundaryUri: image.boundaryUri ?? undefined };
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  // Internal helper to send a specific index
  const sendToPSAtIndex = async (index: number, mode: SendMode) => {
    try {
      setSending(true);
      const resource = images[index].resource;
      if (!resource) {
        console.warn('[ImagePreviewWrapper] Missing resource for import', images[index]);
        return;
      }
      const params = resolveSendParams(images[index], mode);
      if (!params) {
        console.warn('[ImagePreviewWrapper] Unable to resolve send parameters', images[index], mode);
        return;
      }
      await sdpppSDK.plugins.photoshop.importImage({
        resource,
        boundaryUri: params.boundaryUri,
        type: params.type,
        // Pass through original image dimensions when known
        sourceWidth: (images as any)[index]?.width,
        sourceHeight: (images as any)[index]?.height
      } as any);
    } catch (error) {
      console.warn('[ImagePreviewWrapper] sendToPSAtIndex failed', error);
    } finally {
      setSending(false);
    }
  };

  const handleSendMode = async (mode: SendMode) => {
    await sendToPSAtIndex(normalizedIndex, mode);
  };

  const toggleAutoMode = React.useCallback((mode: SendMode) => {
    setAutoMode(prev => {
      const next = prev === mode ? null : mode;
      autoModeRef.current = next;
      return next;
    });
  }, []);

  const handleModeButtonClick = React.useCallback((mode: SendMode) => async (event: React.MouseEvent<HTMLButtonElement>) => {
    if (event.shiftKey) {
      event.preventDefault();
      toggleAutoMode(mode);
      return;
    }
    try {
      await handleSendMode(mode);
    } catch (error) {
      console.warn('[ImagePreviewWrapper] send failed', error);
    }
  }, [handleSendMode, toggleAutoMode]);

  const handleModeButtonContextMenu = React.useCallback((mode: SendMode) => (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    toggleAutoMode(mode);
  }, [toggleAutoMode]);

  // Send by URL using resource once ready
  const sendResourceByUrl = async (url: string) => {
    const mode = autoModeRef.current;
    if (!mode) {
      return;
    }
    const list = MainStore.getState().previewImageList;
    const item = list.find(it => it.url === url);
    if (!item || !item.resource) {
      return;
    }
    const params = resolveSendParams(item, mode);
    if (!params) {
      console.warn('[ImagePreviewWrapper] Auto send skipped due to invalid parameters', item, mode);
      return;
    }
    try {
      setSending(true);
      await sdpppSDK.plugins.photoshop.importImage({
        resource: item.resource,
        boundaryUri: params.boundaryUri,
        type: params.type,
        sourceWidth: (item as any)?.width,
        sourceHeight: (item as any)?.height,
      } as any);
    } catch (error) {
      console.warn('[ImagePreviewWrapper] auto send failed', error);
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    MainStore.setState({ showingPreview: false });
  };

  const handleDeleteCurrent = async () => {
    const current = images[normalizedIndex];
    if (current?.resource) {
      await MainStore.getState().deletePreviewImages([current.resource]);
    } else {
      const newImages = images.filter((_, index) => index !== normalizedIndex);
      MainStore.setState({ previewImageList: newImages });
    }
    const nextList = MainStore.getState().previewImageList;
    if (normalizedIndex >= nextList.length && nextList.length > 0) {
      setCurrentIndex(nextList.length - 1);
    } else if (!nextList.length) {
      setCurrentIndex(0);
    }
  };

  const handleClearAll = async () => {
    const resources = images
      .map(image => image.resource)
      .filter((res): res is string => !!res);
    if (resources.length) {
      await MainStore.getState().deletePreviewImages(resources);
    } else {
      MainStore.setState({ previewImageList: [] });
    }
    setCurrentIndex(0);
  };

  const handleSendAll = async (event?: React.MouseEvent) => {
    setSendingAll(true);
    try {
      const imageItems = images.filter(image => isImage(image.url));
      if (imageItems.length === 0) {
        return;
      }

      const type = event?.shiftKey ? 'newdoc' : 'smartobject';
      const promises = imageItems.map(image => {
        if (!image.resource) {
          console.warn('[ImagePreviewWrapper] skip sendAll without resource', image.url);
          return Promise.resolve();
        }
        return sdpppSDK.plugins.photoshop.importImage({
          resource: image.resource,
          boundaryUri: image.boundaryUri ?? undefined,
          type: type,
          sourceWidth: (image as any)?.width,
          sourceHeight: (image as any)?.height
        } as any);
      });
      await Promise.all(promises);
    } finally {
      setSendingAll(false);
    }
  };

  const handleSaveAll = () => {
    const resources = images
      .map(image => image.resource)
      .filter((res): res is string => !!res);
    if (resources.length) {
      void saveResources(resources);
    }
  };

  const handleSaveCurrent = async () => {
    if (!currentItem?.resource) return;
    await saveResources([currentItem.resource]);
  };

  const handleJumpToLast = () => {
    if (images.length > 0) {
      setCurrentIndex(images.length - 1);
    }
  };

  const [prevLength, setPrevLength] = React.useState(images.length);
  React.useEffect(() => {
    if (currentIndex === prevLength - 1 && images.length > prevLength) {
      handleNext();
    }
    setPrevLength(images.length);
  }, [images.length, currentIndex]);

  // Auto-send newly received images when auto is active, waiting for resource
  const autoPrevLenRef = React.useRef(images.length);
  const scheduleAutoSendForUrl = (url: string) => {
    if (pendingAutoSendRef.current.has(url)) return;
    const token = { cancel: false };
    pendingAutoSendRef.current.set(url, token);
    (async () => {
      try {
        while (!token.cancel && autoModeRef.current !== null) {
          const list = MainStore.getState().previewImageList;
          const item = list.find(it => it.url === url);
          if (!item) break; // deleted
          const downloading = (item as any)?.downloading === true;
          if (!downloading && !!item.resource) {
            await sendResourceByUrl(url);
            break;
          }
          await new Promise(res => setTimeout(res, 200));
        }
      } finally {
        pendingAutoSendRef.current.delete(url);
      }
    })();
  };
  React.useEffect(() => {
    if (autoMode === null) {
      pendingAutoSendRef.current.forEach(t => (t.cancel = true));
      pendingAutoSendRef.current.clear();
      autoPrevLenRef.current = images.length;
      return;
    }
    autoPrevLenRef.current = images.length;
  }, [autoMode, images.length]);

  React.useEffect(() => {
    if (autoMode === null) {
      return;
    }
    if (images.length > autoPrevLenRef.current) {
      for (let i = autoPrevLenRef.current; i < images.length; i++) {
        const itm = images[i];
        if (itm && isImage(itm.url)) {
          scheduleAutoSendForUrl(itm.url);
        }
      }
    }
    autoPrevLenRef.current = images.length;
  }, [images.length, autoMode]);

  React.useEffect(() => {
    return () => {
      // cancel pending tasks on unmount
      pendingAutoSendRef.current.forEach(t => (t.cancel = true));
      pendingAutoSendRef.current.clear();
    };
  }, []);

  if (!images.length) {
    return null;
  }

  const actionButtons = {
    close: (
      <Button
        className="image-preview__close-btn"
        type="text"
        icon={<Minimize2 size={ICON_SIZE} />}
        onClick={handleClose}
        size="middle"
      />
    ),
    prev: images.length > 1 ? (
      <Button
        className="image-preview__nav image-preview__nav--prev"
        icon={<ChevronLeft size={ICON_SIZE} />}
        onClick={handlePrev}
        shape="circle"
        size="middle"
      />
    ) : null,
    next: images.length > 1 ? (
      <Button
        className="image-preview__nav image-preview__nav--next"
        icon={<ChevronRight size={ICON_SIZE} />}
        onClick={handleNext}
        shape="circle"
        size="middle"
      />
    ) : null,
    jumpToLast: normalizedIndex < images.length - 1 ? (
      <Button
        className="image-preview__floating-btn--jump"
        icon={<StepForward size={ICON_SIZE} />}
        onClick={handleJumpToLast}
        shape="circle"
        size="middle"
        title={t('image.jump_to_last')}
      />
    ) : null,
    deleteCurrent: (
      <Button
        className="image-preview__floating-btn--delete"
        icon={<Trash2 size={ICON_SIZE} />}
        onClick={handleDeleteCurrent}
        shape="circle"
        size="middle"
        title={t('image.delete_current')}
      />
    ),
    indicator: (
      <div className="image-preview__indicator">
        {normalizedIndex + 1} / {images.length}
      </div>
    ),
    bottomDeleteAll: (
      <Button
        className="image-preview__bottom-delete-all"
        icon={<Trash2 size={ICON_SIZE} />}
        onClick={handleClearAll}
        shape="circle"
        size="large"
        title={t('image.clear_all')}
      />
    ),
    bottomDeleteCurrent: (
      <div className="image-preview__bottom-delete-current" style={{ background: 'transparent', boxShadow: 'none', color: 'inherit' }}>
        <Button
          icon={<Trash2 size={ICON_SIZE} />}
          onClick={handleDeleteCurrent}
          size="middle"
          type="default"
          style={{ width: '56px' }}
          title={t('image.delete_current')}
        />
      </div>
    ),
    bottomSend: isCurrentItemImage ? (
      <div className="image-preview__bottom-send">
        {(['smartobject', 'newdoc', 'selection'] as SendMode[]).map(mode => {
          const isSelectionMode = mode === 'selection';
          const disabled =
            sending ||
            sendingAll ||
            (isSelectionMode && !selectionBoundaryUri);
          const icon =
            mode === 'smartobject'
              ? <Send size={ICON_SIZE} />
              : mode === 'newdoc'
                ? <FilePlus2 size={ICON_SIZE} />
                : <BoxSelect size={ICON_SIZE} />;
          const tooltipBase =
            mode === 'smartobject'
              ? t('image.import_as_smartobject')
              : mode === 'newdoc'
                ? t('image.import_as_newdoc')
                : `${t('image.import_selection_button')} - ${t('image.import_selection_hint')}`;
          const tooltip = `${tooltipBase} | ${t('image.import_auto_hint')}`;
          const testId =
            mode === 'smartobject'
              ? 'image-preview-send-smartobject'
              : mode === 'newdoc'
                ? 'image-preview-send-newdoc'
                : 'image-preview-send-selection';
          return (
            <Tooltip key={mode} title={tooltip} placement="top">
              <SwitchButton
                className="image-preview__switch-button"
                disabled={disabled}
                icon={icon}
                aria-pressed={autoMode === mode}
                onClick={handleModeButtonClick(mode)}
                onContextMenu={handleModeButtonContextMenu(mode)}
                style={{ width: SWITCH_BUTTON_SIZE, height: SWITCH_BUTTON_SIZE, padding: 0 }}
                type="primary"
                value={autoMode === mode}
                data-testid={testId}
              />
            </Tooltip>
          );
        })}
      </div>
    ) : (
      <Button
        className="image-preview__bottom-save"
        type="primary"
        onClick={handleSaveCurrent}
        size="middle"
        style={{ width: '56px' }}
      >
        <Save size={ICON_SIZE} />
      </Button>
    ),
    bottomIndicator: (
      <Dropdown
        menu={{
          items: [
            {
              key: 'saveCurrent',
              label: t('image.save_current'),
              icon: <Save size={ICON_SIZE} />,
              onClick: handleSaveCurrent
            },
            {
              key: 'saveAll',
              label: t('image.save_all'),
              icon: <Save size={ICON_SIZE} />,
              onClick: handleSaveAll
            },
            {
              type: 'divider'
            },
            {
              key: 'clearAll',
              label: t('image.clear_all'),
              icon: <Trash2 size={ICON_SIZE} />,
              onClick: handleClearAll
            }
          ]
        }}
        placement="topRight"
        trigger={['hover']}
        overlayStyle={{ minWidth: 'auto', width: 'max-content' }}
      >
        <div className="image-preview__bottom-indicator" style={{ cursor: 'pointer' }}>
          {normalizedIndex + 1} / {images.length} <MoreVertical size={ICON_SIZE} />
        </div>
      </Dropdown>
    )
  };

  return (
    <>
      <div className="image-preview">
        {actionButtons.close}

        <div className="image-preview__container">
          <ImagePreview
            images={images}
            currentIndex={normalizedIndex}
            onIndexChange={setCurrentIndex}
          />

          {actionButtons.prev}

          <div className="image-preview__right-buttons">
            {actionButtons.next}
            {actionButtons.jumpToLast}
          </div>
        </div>


        {actionButtons.bottomIndicator}
        {actionButtons.bottomDeleteCurrent}
        {actionButtons.bottomSend}
      </div>
      <Divider />
    </>
  );
}
