import { memo, type FC, type CSSProperties } from 'react';
import {
  ExclusiveSyncGroup,
  type ExclusiveSyncGroupProps,
} from '../ExclusiveSyncGroup/ExclusiveSyncGroup';
import { ImagePreviewFrame } from '../ImagePreviewFrame/ImagePreviewFrame';

export interface ImageSyncGroupProps extends ExclusiveSyncGroupProps {
  imageUrl: string;
  buttonSize?: number | string;
  'data-testid'?: string;
  // visual enhancements
  background?: 'checkerboard' | 'white';
  // styles/classes applied to the inner preview frame (contained area)
  previewStyle?: CSSProperties;
  previewClassName?: string;
}

const ImageSyncGroupComponent: FC<ImageSyncGroupProps> = ({
  imageUrl,
  buttonSize,
  buttons,
  'data-testid': dataTestId,
  background = 'checkerboard',
  previewStyle,
  previewClassName,
  ...exclusiveSyncGroupProps
}) => {
    return (
      <div
        data-testid={dataTestId}
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: '8px',
          width: '100%',
        }}
      >
        <div style={{ flex: '0 0 auto' }}>
          <ExclusiveSyncGroup
            buttons={buttons}
            buttonSize={buttonSize}
            {...exclusiveSyncGroupProps}
          />
        </div>
        <div style={{ position: 'relative', flex: '1 1 0%', minWidth: 160 }}>
          <ImagePreviewFrame
            imageUrl={imageUrl}
            background={background}
            previewStyle={previewStyle}
            previewClassName={previewClassName}
          />
        </div>
      </div>
    );
  };

export const ImageSyncGroup = memo(ImageSyncGroupComponent, (prevProps, nextProps) => {
  return (
    prevProps.imageUrl === nextProps.imageUrl &&
    prevProps.buttonSize === nextProps.buttonSize &&
    prevProps.background === nextProps.background &&
    prevProps['data-testid'] === nextProps['data-testid'] &&
    JSON.stringify(prevProps.buttons) === JSON.stringify(nextProps.buttons)
  );
});
