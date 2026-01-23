import type { ButtonProps } from 'antd';
import { Button } from 'antd';
import React, { useMemo } from 'react';

const SWITCH_BUTTON_STYLE_ID = 'sdppp-switch-button-style';
const ensureSwitchButtonStyle = () => {
  if (typeof document === 'undefined') {
    return;
  }
  if (document.getElementById(SWITCH_BUTTON_STYLE_ID)) {
    return;
  }
  const styleElement = document.createElement('style');
  styleElement.id = SWITCH_BUTTON_STYLE_ID;
  styleElement.textContent = `
    @keyframes sdppp-switch-button-pulse {
      0% { filter: brightness(75%); }
      50% { filter: brightness(125%); }
      100% { filter: brightness(75%); }
    }

    .switch-button-pulse {
      animation: sdppp-switch-button-pulse 1.6s ease-in-out infinite;
    }
  `;
  document.head.appendChild(styleElement);
};

export interface SwitchButtonProps extends ButtonProps {
  value?: boolean;
}

export const SwitchButton: React.FC<SwitchButtonProps> = ({
  value = false,
  className,
  ...rest
}) => {
  ensureSwitchButtonStyle();

  const mergedClassName = useMemo(() => {
    const classes = [
      className,
      value ? 'switch-button-pulse' : undefined,
    ];
    return classes.filter(Boolean).join(' ') || undefined;
  }, [className, value]);

  return (
    <Button
      {...rest}
      className={mergedClassName}
    />
  );
};
