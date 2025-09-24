import React from 'react';
import { Button, Divider, Dropdown, Space, Tooltip } from 'antd';
import { CloseOutlined, DeleteOutlined, StepForwardOutlined, SendOutlined, LeftOutlined, RightOutlined, MoreOutlined, SaveOutlined, ShrinkOutlined } from '@ant-design/icons';
import { MainStore } from '../App.store';
import { sdpppSDK } from '@sdppp/common';
import { useTranslation } from '@sdppp/common';
import { isImage } from '../../utils/fileType';
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
  const [isShiftPressed, setIsShiftPressed] = React.useState(false);

  const currentItem = images[currentIndex];
  const isCurrentItemImage = currentItem ? isImage(currentItem.url) : false;

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

  const handleSendToPS = async (event?: React.MouseEvent) => {
    try {
      setSending(true);
      const type = event?.shiftKey ? 'newdoc' : 'smartobject';
      await sdpppSDK.plugins.photoshop.importImage({
        nativePath: images[currentIndex].nativePath || images[currentIndex].url,
        // Pass boundary if available; default to 'canvas'
        boundary: images[currentIndex].boundary ?? 'canvas',
        type: type,
        // Pass through original image dimensions when known
        sourceWidth: (images as any)[currentIndex]?.width,
        sourceHeight: (images as any)[currentIndex]?.height
      });
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    MainStore.setState({ showingPreview: false });
  };

  const handleDeleteCurrent = () => {
    const newImages = images.filter((_, index) => index !== currentIndex);
    MainStore.setState({ previewImageList: newImages });
    if (currentIndex >= newImages.length && newImages.length > 0) {
      setCurrentIndex(newImages.length - 1);
    }
  };

  const handleClearAll = () => {
    MainStore.setState({ previewImageList: [] });
  };

  const handleSendAll = async (event?: React.MouseEvent) => {
    setSendingAll(true);
    try {
      const imageItems = images.filter(image => isImage(image.url));
      if (imageItems.length === 0) {
        return;
      }

      const type = event?.shiftKey ? 'newdoc' : 'smartobject';
      const promises = imageItems.map(image =>
        sdpppSDK.plugins.photoshop.importImage({
          nativePath: image.nativePath || image.url,
          boundary: image.boundary ?? 'canvas',
          type: type,
          sourceWidth: (image as any)?.width,
          sourceHeight: (image as any)?.height
        })
      );
      await Promise.all(promises);
    } finally {
      setSendingAll(false);
    }
  };

  const handleSaveAll = () => {
    sdpppSDK.plugins.photoshop.requestAndDoSaveImage({
      nativePaths: images.map(image => image.nativePath)
    });
  };

  const handleSaveCurrent = async () => {
    await sdpppSDK.plugins.photoshop.requestAndDoSaveImage({
      nativePaths: [currentItem.nativePath]
    });
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

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        setIsShiftPressed(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        setIsShiftPressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
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
        icon={<ShrinkOutlined />}
        onClick={handleClose}
        size="middle"
      />
    ),
    prev: images.length > 1 ? (
      <Button
        className="image-preview__nav image-preview__nav--prev"
        icon={<LeftOutlined />}
        onClick={handlePrev}
        shape="circle"
        size="middle"
      />
    ) : null,
    next: images.length > 1 ? (
      <Button
        className="image-preview__nav image-preview__nav--next"
        icon={<RightOutlined />}
        onClick={handleNext}
        shape="circle"
        size="middle"
      />
    ) : null,
    jumpToLast: currentIndex < images.length - 1 ? (
      <Button
        className="image-preview__floating-btn--jump"
        icon={<StepForwardOutlined />}
        onClick={handleJumpToLast}
        shape="circle"
        size="middle"
        title={t('image.jump_to_last', 'Jump to Last')}
      />
    ) : null,
    deleteCurrent: (
      <Button
        className="image-preview__floating-btn--delete"
        icon={<DeleteOutlined />}
        onClick={handleDeleteCurrent}
        shape="circle"
        size="middle"
        title={t('image.delete_current', 'Delete Current')}
      />
    ),
    indicator: (
      <div className="image-preview__indicator">
        {currentIndex + 1} / {images.length}
      </div>
    ),
    bottomDeleteAll: (
      <Button
        className="image-preview__bottom-delete-all"
        icon={<DeleteOutlined />}
        onClick={handleClearAll}
        shape="circle"
        size="large"
        title={t('image.clear_all', 'Clear All')}
      />
    ),
    bottomDeleteCurrent: (
      <Button
        className="image-preview__bottom-delete-current"
        icon={<DeleteOutlined />}
        onClick={handleDeleteCurrent}
        size="middle"
        style={{ width: '64px', height: '32px' }}
        title={t('image.delete_current', 'Delete Current')}
      />
    ),
    bottomSend: isCurrentItemImage ? (
      <Tooltip
        title={
          <div>
            <div>{isShiftPressed ? t('image.import_as_newdoc', 'Import as New Document') : t('image.import_as_smartobject', 'Import as Smart Object')}</div>
            {currentItem?.boundary && (
              <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '4px' }}>
                {t('image.boundary', 'Boundary')}: {getBoundaryText(currentItem.boundary)}
              </div>
            )}
            <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '2px' }}>
              {t('image.import_tip', 'Shift: New doc; Default: Smart Object')}
            </div>
          </div>
        }
        placement="top"
      >
        <Button
          className="image-preview__bottom-send"
          type="primary"
          onClick={(e) => handleSendToPS(e)}
          size="middle"
          loading={sending}
          disabled={sending || sendingAll}
          style={{ width: '64px', height: '32px' }}
        >
          {sending ? t('image.sending', 'Sending...') : <SendOutlined />}
        </Button>
      </Tooltip>
    ) : (
      <Button
        className="image-preview__bottom-save"
        type="primary"
        onClick={handleSaveCurrent}
        size="middle"
        style={{ width: '64px', height: '32px' }}
      >
        <SaveOutlined />
      </Button>
    ),
    bottomIndicator: (
      <Dropdown
        menu={{
          items: [
            {
              key: 'saveCurrent',
              label: t('image.save_current', 'Save Current'),
              icon: <SaveOutlined />,
              onClick: handleSaveCurrent
            },
            {
              key: 'saveAll',
              label: t('image.save_all', 'Save All'),
              icon: <SaveOutlined />,
              onClick: handleSaveAll
            },
            {
              type: 'divider'
            },
            {
              key: 'clearAll',
              label: t('image.clear_all', 'Clear All'),
              icon: <DeleteOutlined />,
              onClick: handleClearAll
            }
          ]
        }}
        placement="topRight"
        trigger={['hover']}
        overlayStyle={{ minWidth: 'auto', width: 'max-content' }}
      >
        <div className="image-preview__bottom-indicator" style={{ cursor: 'pointer' }}>
          {currentIndex + 1} / {images.length} <MoreOutlined />
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
            currentIndex={currentIndex}
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
