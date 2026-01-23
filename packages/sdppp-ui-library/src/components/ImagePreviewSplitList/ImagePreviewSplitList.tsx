import { cloneElement, isValidElement } from 'react';
import type { CSSProperties, FC, ReactElement } from 'react';
import { ImagePreviewSplit } from '../ImagePreviewSplit/ImagePreviewSplit';
import type { ImagePreviewSplitProps } from '../ImagePreviewSplit/ImagePreviewSplit';

export interface ImagePreviewSplitListItem extends ImagePreviewSplitProps {
  id?: string | number;
}

type ImagePreviewSplitListRenderable = ImagePreviewSplitListItem | ReactElement;

export interface ImagePreviewSplitListProps {
  items: ImagePreviewSplitListRenderable[];
  gap?: number | string;
  className?: string;
  style?: CSSProperties;
}

export const ImagePreviewSplitList: FC<ImagePreviewSplitListProps> = ({
  items,
  gap = 12,
  className,
  style,
}) => {
  const gapValue =
    typeof gap === 'number' ? `${gap}px` : gap;

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: gapValue,
        width: '100%',
        ...style,
      }}
    >
      {items.map((item, index) => {
        if (isValidElement(item)) {
          const key = item.key ?? index;
          return cloneElement(item, { key });
        }

        const { id, ...rest } = item;
        const key = id ?? index;
        return <ImagePreviewSplit key={key} {...rest} />;
      })}
    </div>
  );
};
