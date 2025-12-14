import { useMemo } from 'react';

import { useWidgetText } from '../context/PhotoshopWidgetContext';

export interface UploadCopy {
  errorLabel: string;
}

export const useUploadCopy = (): UploadCopy => {
  const t = useWidgetText();

  const errorLabel = useMemo(
    () => t('image.upload.error', { defaultValue: '上传失败，请重试' }),
    [t],
  );

  return { errorLabel };
};

export default useUploadCopy;
