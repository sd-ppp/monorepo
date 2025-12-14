import { useEffect, useRef, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

export interface InteractionState {
  isGearButtonHovered: boolean;
  setIsGearButtonHovered: Dispatch<SetStateAction<boolean>>;
  isStatusBarHovered: boolean;
  setIsStatusBarHovered: Dispatch<SetStateAction<boolean>>;
  isMaskButtonHovered: boolean;
  setIsMaskButtonHovered: Dispatch<SetStateAction<boolean>>;
  isStatusBarVisible: boolean;
  gearHoverTimeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
}

export const useInteractionState = (): InteractionState => {
  const [isGearButtonHovered, setIsGearButtonHovered] = useState(false);
  const [isStatusBarHovered, setIsStatusBarHovered] = useState(false);
  const [isMaskButtonHovered, setIsMaskButtonHovered] = useState(false);
  const gearHoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isStatusBarVisible = isGearButtonHovered || isStatusBarHovered;

  useEffect(
    () => () => {
      if (gearHoverTimeoutRef.current) {
        clearTimeout(gearHoverTimeoutRef.current);
        gearHoverTimeoutRef.current = null;
      }
    },
    [],
  );

  return {
    isGearButtonHovered,
    setIsGearButtonHovered,
    isStatusBarHovered,
    setIsStatusBarHovered,
    isMaskButtonHovered,
    setIsMaskButtonHovered,
    isStatusBarVisible,
    gearHoverTimeoutRef,
  };
};
