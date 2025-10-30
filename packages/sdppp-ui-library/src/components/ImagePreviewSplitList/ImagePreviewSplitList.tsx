import type { CSSProperties, FC } from 'react';
import { ImagePreviewSplit } from '../ImagePreviewSplit/ImagePreviewSplit';
import type { ImagePreviewSplitProps } from '../ImagePreviewSplit/ImagePreviewSplit';

export interface ImagePreviewSplitListItem extends ImagePreviewSplitProps {
  id?: string | number;
}

export interface ImagePreviewSplitListProps {
  items: ImagePreviewSplitListItem[];
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
        const { id, ...rest } = item;
        const key = id ?? index;
        return <ImagePreviewSplit key={key} {...rest} />;
      })}
    </div>
  );
};
