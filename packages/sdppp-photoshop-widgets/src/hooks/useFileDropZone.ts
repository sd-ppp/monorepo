import { useCallback, useRef, useState, type DragEvent } from 'react';

export interface FileDropZoneOptions {
  onDropFiles: (files: File[], event: DragEvent<HTMLElement>) => void | Promise<void>;
  accept?: (file: File) => boolean;
  multiple?: boolean;
  disabled?: boolean;
}

export interface FileDropZoneHandlers {
  onDragEnter: (event: DragEvent<HTMLElement>) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDragLeave: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
}

export interface FileDropZone {
  isDragging: boolean;
  handlers: FileDropZoneHandlers;
}

const isFileTransfer = (event: DragEvent<HTMLElement>): boolean => {
  const { dataTransfer } = event;
  if (!dataTransfer) return false;
  if (dataTransfer.types) {
    return Array.from(dataTransfer.types).some(type => type === 'Files');
  }
  return dataTransfer.files && dataTransfer.files.length > 0;
};

export const useFileDropZone = ({
  onDropFiles,
  accept,
  multiple = true,
  disabled = false,
}: FileDropZoneOptions): FileDropZone => {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const resetDragState = useCallback(() => {
    dragCounterRef.current = 0;
    setIsDragging(false);
  }, []);

  const handleDragEnter = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (disabled) return;
      if (!isFileTransfer(event)) return;
      event.preventDefault();
      event.stopPropagation();
      dragCounterRef.current += 1;
      setIsDragging(true);
    },
    [disabled],
  );

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (disabled) return;
      if (!isFileTransfer(event)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy';
      }
    },
    [disabled],
  );

  const handleDragLeave = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (!isFileTransfer(event)) return;
      event.preventDefault();
      event.stopPropagation();
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
      if (dragCounterRef.current === 0) {
        setIsDragging(false);
      }
    },
    [],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (disabled) return;
      if (!isFileTransfer(event)) return;
      event.preventDefault();
      event.stopPropagation();
      const transfer = event.dataTransfer;
      const fileList = transfer?.files;
      const files = fileList ? Array.from(fileList) : [];
      const acceptedFiles = typeof accept === 'function' ? files.filter(accept) : files;
      const finalFiles = multiple ? acceptedFiles : acceptedFiles.slice(0, 1);
      resetDragState();
      if (finalFiles.length) {
        void onDropFiles(finalFiles, event);
      }
    },
    [accept, disabled, multiple, onDropFiles, resetDragState],
  );

  return {
    isDragging,
    handlers: {
      onDragEnter: handleDragEnter,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    },
  };
};
