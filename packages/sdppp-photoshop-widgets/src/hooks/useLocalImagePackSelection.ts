import { useMemo } from 'react';
import { useTranslation } from '@sdppp/common';
import {
  useLocalResourceSelection,
  type LocalResourceSelectionItem,
  type LocalResourceSelectionResult,
} from './useLocalResourceSelection';

export type LocalImagePackSelectionItem = LocalResourceSelectionItem;
export type LocalImagePackSelectionResult = LocalResourceSelectionResult;

export const useLocalImagePackSelection = () => {
  const { t } = useTranslation();
  const selectionParams = useMemo(() => ({
    multiple: true,
    types: [
      {
        description: t('local_resource.selection.images', { defaultValue: 'Images' }),
        extensions: ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'],
        accept: {
          'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'],
        },
      },
    ],
  }), [t]);

  return useLocalResourceSelection({
    actionParams: selectionParams as unknown as Record<string, unknown>,
  });
};
