import React, { useCallback, useRef, useState } from 'react';

import type { UploadPassRunSummary } from './types';
import { readBlobAsDataUrl } from './upload-helpers';

export interface ImageUrlsPanelProps {
  imageUrls: string[];
  canEdit?: boolean;
  onReplace?: (index: number, value: string) => void;
  onRunUploadPasses?: () => Promise<UploadPassRunSummary | void>;
  registeredUploadPassCount?: number;
  lastRunSummary?: UploadPassRunSummary | null;
}

export const ImageUrlsPanel: React.FC<ImageUrlsPanelProps> = ({
  imageUrls,
  canEdit = false,
  onReplace,
  onRunUploadPasses,
  registeredUploadPassCount = 0,
  lastRunSummary,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pendingIndexRef = useRef<number | null>(null);
  const [isRunningUploads, setIsRunningUploads] = useState(false);

  const handleTriggerReplace = useCallback(
    (index: number) => {
      if (!canEdit || !onReplace) return;
      pendingIndexRef.current = index;
      const input = inputRef.current;
      if (input) {
        input.click();
      }
    },
    [canEdit, onReplace]
  );

  const handleFileInputChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      const index = pendingIndexRef.current;
      pendingIndexRef.current = null;
      event.target.value = '';
      if (!file || index === null || !onReplace) return;
      try {
        const dataUrl = await readBlobAsDataUrl(file);
        if (!dataUrl) return;
        onReplace(index, dataUrl);
      } catch {
        // Silently ignore file read errors in playground UI
      }
    },
    [onReplace]
  );

  const handleRunUploads = useCallback(async () => {
    if (!onRunUploadPasses || isRunningUploads) return;
    setIsRunningUploads(true);
    try {
      await onRunUploadPasses();
    } finally {
      setIsRunningUploads(false);
    }
  }, [isRunningUploads, onRunUploadPasses]);

  const runButtonDisabled =
    !onRunUploadPasses || registeredUploadPassCount <= 0 || isRunningUploads;

  const runButtonLabel = isRunningUploads
    ? '执行中…'
    : registeredUploadPassCount > 0
      ? `执行上传 (${registeredUploadPassCount})`
      : '执行上传';

  const renderRunSummary = () => {
    if (!lastRunSummary) return null;
    const { total, success, failure, timestamp } = lastRunSummary;
    const timeLabel = new Date(timestamp).toLocaleTimeString();
    return (
      <div
        style={{
          fontSize: 11,
          color: 'rgba(24, 40, 78, 0.6)',
          marginBottom: 6,
          marginTop: -2,
        }}
      >
        最近执行 {timeLabel}：成功 {success}/{total}
        {failure > 0 ? `，失败 ${failure}` : ''}
      </div>
    );
  };

  return (
    <div
      style={{
        border: '1px solid rgba(24, 40, 78, 0.12)',
        borderRadius: 12,
        padding: 12,
        background: '#ffffff',
        boxShadow: '0 10px 24px rgba(34, 56, 112, 0.08)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'rgba(22, 36, 68, 0.95)',
            fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          }}
        >
          图像 URL 面板
        </div>
        <button
          type="button"
          onClick={handleRunUploads}
          disabled={runButtonDisabled}
          style={{
            border: 'none',
            background: runButtonDisabled ? 'rgba(62, 124, 240, 0.12)' : 'rgba(62, 124, 240, 0.16)',
            color: runButtonDisabled ? 'rgba(62, 124, 240, 0.6)' : '#3e7cf0',
            padding: '6px 12px',
            borderRadius: 6,
            cursor: runButtonDisabled ? 'not-allowed' : 'pointer',
            fontSize: 12,
            transition: 'background 0.2s ease',
          }}
        >
          {runButtonLabel}
        </button>
      </div>
      {renderRunSummary()}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {imageUrls.length ? (
          imageUrls.map((url, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: 8,
                borderRadius: 8,
                border: '1px solid rgba(24, 40, 78, 0.12)',
                background: 'rgba(246, 248, 255, 0.6)',
              }}
            >
              <span style={{ fontSize: 12, color: 'rgba(24, 40, 78, 0.6)' }}>#{index + 1}</span>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 6,
                  overflow: 'hidden',
                  background: 'rgba(180, 190, 210, 0.2)',
                  flex: '0 0 auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {url ? (
                  <img
                    src={url}
                    alt={`preview-${index}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span
                    style={{
                      fontSize: 10,
                      color: 'rgba(24, 40, 78, 0.4)',
                    }}
                  >
                    空
                  </span>
                )}
              </div>
              <div
                style={{
                  flex: 1,
                  fontSize: 12,
                  color: 'rgba(24, 40, 78, 0.75)',
                  wordBreak: 'break-all',
                  fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                }}
              >
                {url || '(空)'}
              </div>
              {canEdit && onReplace ? (
                <button
                  type="button"
                  onClick={() => handleTriggerReplace(index)}
                  style={{
                    border: 'none',
                    background: 'rgba(62, 124, 240, 0.12)',
                    color: '#3e7cf0',
                    padding: '6px 12px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  替换
                </button>
              ) : null}
            </div>
          ))
        ) : (
          <div
            style={{
              fontSize: 12,
              color: 'rgba(24, 40, 78, 0.55)',
            }}
          >
            当前组件未提供 imageUrls。
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />
    </div>
  );
};

