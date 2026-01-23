import { useCallback } from 'react';

interface UseWidgetValueEmitterOptions {
  onValueChange?: (value: string[]) => void;
}

export const useWidgetValueEmitter = ({
  onValueChange,
}: UseWidgetValueEmitterOptions): ((value: string[]) => void) =>
  useCallback(
    (next: string[]) => {
      if (!onValueChange) {
        return;
      }

      onValueChange(next);
    },
    [onValueChange],
  );

export default useWidgetValueEmitter;
