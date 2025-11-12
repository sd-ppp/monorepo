import {
  ChevronLeft,
  ChevronRight,
  Minimize2,
  MoreHorizontal,
  Save,
  Send,
  StepForward,
  Trash2,
} from 'lucide-react';
import { sdpppSDK, useTranslation } from '@sdppp/common';
import { SyncButton } from '@sdppp/ui-library';
import { Button, Divider, Dropdown } from 'antd';
import React from 'react';
import { isImage } from '../../utils/fileType';
import { MainStore } from '../App.store';
import ImagePreview from './ImagePreview';

interface ImagePreviewWrapperProps {
  children?: React.ReactNode;
}

export default function ImagePreviewWrapper({ children }: ImagePreviewWrapperProps) {
  const { t } = useTranslation();
  const images = MainStore(state => state.previewImageList);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [sending, setSending] = React.useState(false);
  const [sendingAll, setSendingAll] = React.useState(false);
  const [isAutoSync, setIsAutoSync] = React.useState(false);
  const autoSendTypeRef = React.useRef<'smartobject' | 'newdoc'>('smartobject');
  const pendingAutoSendRef = React.useRef(new Map<string, { cancel: boolean }>());

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

  const currentItem = images[normalizedIndex];
  const isCurrentItemImage = currentItem ? isImage(currentItem.url) : false;
  const ICON_SIZE = 16;

  // Get boundary display text (similar to WorkBoundary.tsx)
  const getBoundaryText = (boundary: any): string => {
    if (!boundary || (boundary.width >= 999999 && boundary.height >= 999999)) {
      return t('boundary.current_canvas', {defaultMessage: 'Entire Canvas'});
    }
    return `(${boundary.leftDistance}, ${boundary.topDistance}, ${boundary.width}, ${boundary.height})`;
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  // Internal helper to send a specific index
  const sendToPSAtIndex = async (index: number, opts?: { shiftKey?: boolean }) => {
    try {
      setSending(true);
      const type = opts?.shiftKey ? 'newdoc' : 'smartobject';
      const resource = images[index].resource;
      if (!resource) {
        console.warn('[ImagePreviewWrapper] Missing resource for import', images[index]);
        return;
      }
      await sdpppSDK.plugins.photoshop.importImage({
        resource,
        // Pass boundary if available; default to 'canvas'
        boundary: images[index].boundary ?? 'canvas',
        type: type,
        // Pass through original image dimensions when known
        sourceWidth: (images as any)[index]?.width,
        sourceHeight: (images as any)[index]?.height
      } as any);
    } finally {
      setSending(false);
    }
  };

  const handleSendToPS = async (event?: { shiftKey?: boolean }) => {
    await sendToPSAtIndex(normalizedIndex, { shiftKey: !!event?.shiftKey });
  };

  // Send by URL using resource once ready
  const sendResourceByUrl = async (url: string) => {
    try {
      setSending(true);
      const list = MainStore.getState().previewImageList;
      const item = list.find(it => it.url === url);
      if (!item || !item.resource) {
        return;
      }
      const type = autoSendTypeRef.current;
      await sdpppSDK.plugins.photoshop.importImage({
        resource: item.resource,
        boundary: item.boundary ?? 'canvas',
        type,
        sourceWidth: (item as any)?.width,
        sourceHeight: (item as any)?.height,
      } as any);
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
          boundary: image.boundary ?? 'canvas',
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
      sdpppSDK.plugins.photoshop.requestAndDoSaveImage({ resources } as any);
    }
  };

  const handleSaveCurrent = async () => {
    if (!currentItem?.resource) return;
    await sdpppSDK.plugins.photoshop.requestAndDoSaveImage({
      resources: [currentItem.resource]
    } as any);
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
        while (!token.cancel && isAutoSync) {
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
    if (!isAutoSync) {
      // cancel all pending tasks when auto-sync turns off
      pendingAutoSendRef.current.forEach(t => (t.cancel = true));
      pendingAutoSendRef.current.clear();
      autoPrevLenRef.current = images.length;
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
  }, [images.length, isAutoSync]);

  React.useEffect(() => {
    return () => {
      // cancel pending tasks on unmount
      pendingAutoSendRef.current.forEach(t => (t.cancel = true));
      pendingAutoSendRef.current.clear();
    };
  }, []);

  const handleAutoSyncToggle = React.useCallback(({ shiftKey }: { shiftKey: boolean }) => {
    setIsAutoSync(prev => {
      const next = !prev;
      if (!prev && next) {
        autoSendTypeRef.current = shiftKey ? 'newdoc' : 'smartobject';
      }
      return next;
    });
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
        <SyncButton
          disabled={sending || sendingAll}
          isAutoSync={isAutoSync}
          onSync={({ shiftKey }) => handleSendToPS({ shiftKey })}
          onAutoSyncToggle={handleAutoSyncToggle}
          buttonSize={88}
          mainButtonType="primary"
          autoSyncButtonTooltips={{
            enabled: t('image.auto_send_enabled'),
            disabled: t('image.auto_send_disabled')
          }}
          syncButtonTooltip={t('image.import_as_smartobject') + ' | ' + t('image.import_tip')}
          data-testid="image-preview-sync-button"
        >
          {sending ? t('image.sending') : <Send size={ICON_SIZE} />}
        </SyncButton>
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
          {normalizedIndex + 1} / {images.length} <MoreHorizontal size={ICON_SIZE} />
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
