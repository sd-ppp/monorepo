import {
  useLocalResourceSelection,
  type LocalResourceSelectionItem,
  type LocalResourceSelectionResult,
} from '../local-resource-selection/useLocalResourceSelection';

const IMAGE_SELECTION_PARAMS = {
  multiple: true,
  types: [
    {
      description: 'Images',
      extensions: ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'],
      accept: {
        'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'],
      },
    },
  ],
} as const;

export type LocalImagePackSelectionItem = LocalResourceSelectionItem;
export type LocalImagePackSelectionResult = LocalResourceSelectionResult;

export const useLocalImagePackSelection = () => {
  return useLocalResourceSelection({
    actionParams: IMAGE_SELECTION_PARAMS as unknown as Record<string, unknown>,
  });
};
