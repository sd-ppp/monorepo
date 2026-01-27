import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const HOVER_EXIT_DELAY_MS = 200;

export interface RunHoverHandlers {
  onRunButtonEnter: () => void;
  onRunButtonLeave: () => void;
  onMultiplierEnter: () => void;
  onMultiplierLeave: () => void;
  showMultiplierControls: boolean;
}

export const useRunHover = (): RunHoverHandlers => {
  const [isHoverVisible, setIsHoverVisible] = useState(false);
  const [isMultiplierHovering, setIsMultiplierHovering] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimeoutRef = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const showHover = useCallback(() => {
    clearTimeoutRef();
    setIsHoverVisible(true);
  }, [clearTimeoutRef]);

  const scheduleHideHover = useCallback(() => {
    clearTimeoutRef();
    timeoutRef.current = setTimeout(() => {
      setIsHoverVisible(false);
      timeoutRef.current = null;
    }, HOVER_EXIT_DELAY_MS);
  }, [clearTimeoutRef]);

  const onRunButtonEnter = useCallback(() => {
    showHover();
  }, [showHover]);

  const onRunButtonLeave = useCallback(() => {
    scheduleHideHover();
  }, [scheduleHideHover]);

  const onMultiplierEnter = useCallback(() => {
    setIsMultiplierHovering(true);
    showHover();
  }, [showHover]);

  const onMultiplierLeave = useCallback(() => {
    setIsMultiplierHovering(false);
    scheduleHideHover();
  }, [scheduleHideHover]);

  useEffect(() => () => {
    clearTimeoutRef();
  }, [clearTimeoutRef]);

  const showMultiplierControls = useMemo(
    () => isHoverVisible || isMultiplierHovering,
    [isHoverVisible, isMultiplierHovering],
  );

  return {
    onRunButtonEnter,
    onRunButtonLeave,
    onMultiplierEnter,
    onMultiplierLeave,
    showMultiplierControls,
  };
};
