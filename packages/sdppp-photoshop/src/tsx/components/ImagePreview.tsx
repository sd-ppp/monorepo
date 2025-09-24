import React, { useEffect, useState } from 'react';
import { Image, Spin } from 'antd';
import { isVideo } from '../../utils/fileType';
import { RectSchema } from '../../../internals/mcp-mesh-photoshop/actions/uxp-photoshop-defs';
import { z } from 'zod';
import './ImagePreview.less';

type Rect = z.infer<typeof RectSchema>;

interface ImagePreviewProps {
  images: Array<{
    url: string;
    source: string;
    thumbnail_url: string;
    nativePath?: string;
    metadata?: {
      genByDocument: number;
      boundary: Rect;
    };
    downloading?: boolean;
  }>;
  currentIndex: number;
  onIndexChange?: (index: number) => void;
}

export default function ImagePreview({ images, currentIndex, onIndexChange }: ImagePreviewProps) {
  const [imageLoading, setImageLoading] = useState(false);
  const [previousUrl, setPreviousUrl] = useState<string>('');
  const currentImage = images[currentIndex];
  const isDownloading = !!currentImage?.downloading;

  useEffect(() => {
    const currentUrl = images[currentIndex]?.url || '';
    if (currentUrl !== previousUrl) {
      setImageLoading(true);
      setPreviousUrl(currentUrl);
    } else {
      setImageLoading(false);
    }
  }, [currentIndex, images, previousUrl]);

  if (!images.length) {
    return null;
  }

  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '1', maxHeight: '100%' }}>
      {(imageLoading || isDownloading) && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(128, 128, 128, 0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10
        }}>
          <Spin size="large" />
        </div>
      )}

      {isVideo(images[currentIndex].url) ? (
        <video
          src={images[currentIndex].url}
          className="image-preview__image"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            transition: 'opacity 0.2s ease',
            cursor: 'pointer'
          }}
          onLoadedData={() => setImageLoading(false)}
          onError={() => setImageLoading(false)}
          onClick={(e) => {
            const video = e.target as HTMLVideoElement;
            if (video.paused) {
              video.play();
            } else {
              video.pause();
            }
          }}
        />
      ) : (
        currentImage?.thumbnail_url ? (
          <Image
            src={images[currentIndex].thumbnail_url}
            alt={`Preview ${currentIndex + 1}`}
            className="image-preview__image"
            preview={{
              src: images[currentIndex].url,
              render: (originalNode, info) => {
                const previewUrl = info.src || '';
                if (isVideo(previewUrl)) {
                  return (
                    <video
                      src={previewUrl}
                      controls
                      autoPlay
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain'
                      }}
                    />
                  );
                }
                return originalNode;
              }
            }}
            width={'100%'}
            height={'100%'}
            style={{
              objectFit: 'contain',
              transition: 'opacity 0.2s ease'
            }}
            onLoad={() => setImageLoading(false)}
            onError={() => setImageLoading(false)}
          />
        ) : (
          // No thumbnail yet; render blank container and rely on overlay
          <div
            className="image-preview__image"
            style={{ width: '100%', height: '100%' }}
          />
        )
      )}
    </div>
  );
}
