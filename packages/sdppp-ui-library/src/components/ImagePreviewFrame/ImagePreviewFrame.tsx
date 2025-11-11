import { Image } from 'antd';
import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FC,
} from 'react';

export interface ImagePreviewFrameProps {
  imageUrl: string;
  background?: 'checkerboard' | 'white';
  previewStyle?: CSSProperties;
  previewClassName?: string;
  containerStyle?: CSSProperties;
  containerClassName?: string;
  onVisibleChange?: (visible: boolean) => void;
  'data-testid'?: string;
}

const ImagePreviewFrameComponent: FC<ImagePreviewFrameProps> = ({
  imageUrl,
  background = 'checkerboard',
  previewStyle,
  previewClassName,
  containerStyle,
  containerClassName,
  onVisibleChange,
  'data-testid': dataTestId,
}) => {
  const [previewVisible, setPreviewVisible] = useState(false);
  const [imageRatio, setImageRatio] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    // ResizeObserver is unavailable in some test environments; guard accordingly.
    if (typeof ResizeObserver === 'undefined') return;
    const element = containerRef.current;
    if (!element) return;
    const resizeObserver = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setContainerSize(prev => {
        if (prev.width === rect.width && prev.height === rect.height) {
          return prev;
        }
        return {
          width: rect.width,
          height: rect.height,
        };
      });
    });
    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!onVisibleChange) return;
    onVisibleChange(previewVisible);
  }, [onVisibleChange, previewVisible]);

  const backgroundStyle = useMemo(() => {
    if (background === 'checkerboard') {
      return {
        backgroundImage: 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%)',
        backgroundSize: '12px 12px',
        backgroundPosition: '0 0',
      } satisfies CSSProperties;
    }
    return { backgroundColor: '#000' } satisfies CSSProperties;
  }, [background]);

  const ratio = imageRatio ?? 1;
  const { width, height } = containerSize;
  const computedFrameWidth =
    width === 0 || height === 0 ? 0 : Math.min(width, height * ratio);
  const computedFrameHeight =
    width === 0 || height === 0 ? 0 : computedFrameWidth / ratio;
  const useFallbackSize = computedFrameWidth === 0 || computedFrameHeight === 0;

  return (
    <div
      ref={containerRef}
      className={containerClassName}
      data-testid={dataTestId}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        border:
          '1px solid var(--sdppp-widget-border-color, var(--ant-color-border, #d9d9d9))',
        borderRadius: 'var(--sdppp-widget-border-radius, 4px)',
        cursor: imageUrl ? 'pointer' : 'default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...containerStyle,
      }}
      onClick={() => {
        if (imageUrl) setPreviewVisible(true);
      }}
    >
      <div
        className={previewClassName}
        style={{
          width: useFallbackSize ? '100%' : computedFrameWidth,
          height: useFallbackSize ? '100%' : computedFrameHeight,
          ...backgroundStyle,
          ...previewStyle,
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            style={{ width: '100%', height: 'auto', display: 'block' }}
            onLoad={event => {
              const img = event.currentTarget;
              if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                setImageRatio(img.naturalWidth / img.naturalHeight);
              }
            }}
          />
        ) : null}
      </div>

      <Image.PreviewGroup
        preview={{
          visible: previewVisible,
          onVisibleChange: setPreviewVisible,
        }}
        items={imageUrl ? [{ src: imageUrl }] : []}
      />
    </div>
  );
};

export const ImagePreviewFrame = memo(ImagePreviewFrameComponent);
