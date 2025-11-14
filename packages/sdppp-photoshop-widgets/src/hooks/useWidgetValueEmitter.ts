import { useCallback } from 'react';

import type { WidgetImageMaskLogger } from '../context/WidgetImageMaskContext';

interface UseWidgetValueEmitterOptions {
  onValueChange?: (value: string[]) => void;
  logger?: WidgetImageMaskLogger;
  logLabel?: string;
}

export const useWidgetValueEmitter = ({
  onValueChange,
  logger,
  logLabel,
}: UseWidgetValueEmitterOptions): ((value: string[]) => void) =>
  useCallback(
    (next: string[]) => {
      if (!onValueChange) {
        return;
      }

      if (logger && logLabel) {
        try {
          logger(logLabel, JSON.stringify(next));
        } catch {
          // ignore logging failures
        }
      }

      onValueChange(next);
    },
    [logger, logLabel, onValueChange],
  );

export default useWidgetValueEmitter;
