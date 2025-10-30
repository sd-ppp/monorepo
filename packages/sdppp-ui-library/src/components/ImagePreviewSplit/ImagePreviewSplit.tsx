import type { CSSProperties, FC, ReactNode } from 'react';
import { ImagePreviewFrame } from '../ImagePreviewFrame/ImagePreviewFrame';
import type { ImagePreviewFrameProps } from '../ImagePreviewFrame/ImagePreviewFrame';

export interface ImagePreviewSplitProps extends ImagePreviewFrameProps {
  left: ReactNode;
  gap?: number | string;
  className?: string;
  style?: CSSProperties;
  leftContainerClassName?: string;
  leftContainerStyle?: CSSProperties;
  rightContainerClassName?: string;
  rightContainerStyle?: CSSProperties;
}

export const ImagePreviewSplit: FC<ImagePreviewSplitProps> = ({
  left,
  gap = 8,
  className,
  style,
  leftContainerClassName,
  leftContainerStyle,
  rightContainerClassName,
  rightContainerStyle,
  ...previewProps
}) => {
  const gapValue =
    typeof gap === 'number' ? `${gap}px` : gap;

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: gapValue,
        width: '100%',
        ...style,
      }}
      data-testid={previewProps['data-testid']}
    >
      <div
        className={leftContainerClassName}
        style={{
          flex: '0 0 auto',
          ...leftContainerStyle,
        }}
      >
        {left}
      </div>
      <div
        className={rightContainerClassName}
        style={{
          position: 'relative',
          flex: '1 1 0%',
          minWidth: 160,
          ...rightContainerStyle,
        }}
      >
        <ImagePreviewFrame {...previewProps} />
      </div>
    </div>
  );
};
