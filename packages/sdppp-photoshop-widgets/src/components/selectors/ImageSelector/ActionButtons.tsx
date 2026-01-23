import { SwitchButton } from '@sdppp/ui-library';
import { Button } from 'antd';
import { Crop, Import as ImportIcon, Scissors } from 'lucide-react';
import React, { useCallback, useMemo } from 'react';

import { ACTION_BUTTON_MARGIN, ACTION_BUTTON_SIZE, SECTION_SIZE } from './constants';

type SelectionActionButtonsProps = {
  mode: 'selection';
  cutLabel: string;
  scanLabel: string;
  cutTooltipText: string;
  scanTooltipText: string;
  onCut: () => void;
  onScan: () => void;
  onMaskHoverStart?: () => void;
  onMaskHoverEnd?: () => void;
  onBoundaryHoverStart?: () => void;
  onBoundaryHoverEnd?: () => void;
  onHelpHintChange?: (message: string) => void;
};

type SyncActionButtonsProps = {
  mode: 'sync';
  auto: boolean;
  autoButtonTooltip: string;
  manualSyncTooltipText: string;
  autoSyncIcon: React.ReactElement;
  onManualSync: (event: { altKey: boolean; shiftKey: boolean }) => void | Promise<void>;
  onAutoToggle: (event?: { altKey: boolean; shiftKey: boolean }) => void | Promise<void>;
  onHelpHintChange?: (message: string) => void;
  onBoundaryHoverStart?: () => void;
  onBoundaryHoverEnd?: () => void;
};

export type ActionButtonsProps = SelectionActionButtonsProps | SyncActionButtonsProps;

const containerBaseStyle: React.CSSProperties = {
  flex: '0 0 auto',
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  boxSizing: 'border-box',
  borderRadius: '0 var(--ant-border-radius-lg, 6px) var(--ant-border-radius-lg, 6px) 0',
  overflow: 'hidden',
  padding: ACTION_BUTTON_MARGIN,
  gap: ACTION_BUTTON_MARGIN,
};

const ActionButtonContainer: React.FC<{
  align?: 'center' | 'stretch';
  justify?: React.CSSProperties['justifyContent'];
  children: React.ReactNode;
}> = ({ align = 'center', justify = 'space-between', children }) => (
  <div
    style={{
      ...containerBaseStyle,
      alignItems: align === 'stretch' ? 'stretch' : 'center',
      justifyContent: justify,
    }}
  >
    {children}
  </div>
);

const createCutIcon = () => (
  <Scissors size={20} strokeWidth={2} />
);

const createImportIcon = () => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 24,
      height: 24,
    }}
  >
    <ImportIcon
      size={20}
      strokeWidth={2}
      style={{
        transform: 'rotate(90deg)',
        transformOrigin: '50% 50%',
      }}
    />
  </span>
);

const createCropIcon = () => (
  <Crop size={20} strokeWidth={2} />
);

const SelectionButtons: React.FC<Omit<SelectionActionButtonsProps, 'mode'>> = ({
  cutLabel,
  scanLabel,
  cutTooltipText,
  scanTooltipText,
  onCut,
  onScan,
  onMaskHoverStart,
  onMaskHoverEnd,
  onBoundaryHoverStart,
      onBoundaryHoverEnd,
      onHelpHintChange,
    }) => {
  const cutIcon = useMemo(() => createCutIcon(), []);
  const scanIcon = useMemo(() => createCropIcon(), []);
  const buttonStyle = useMemo(
    () => ({
      width: ACTION_BUTTON_SIZE,
      height: ACTION_BUTTON_SIZE,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 0,
    }),
    [],
  );

  return (
    <ActionButtonContainer justify="space-between">
      <Button
        type="primary"
        icon={cutIcon}
        aria-label={cutLabel}
        style={{
          ...buttonStyle,
          alignSelf: 'center',
        }}
        onClick={onCut}
        onMouseEnter={() => {
          onMaskHoverStart?.();
          onHelpHintChange?.(cutTooltipText);
        }}
        onMouseLeave={() => {
          onMaskHoverEnd?.();
          onHelpHintChange?.('');
        }}
      />
      <Button
        type="primary"
        icon={scanIcon}
        aria-label={scanLabel}
        style={{
          ...buttonStyle,
          alignSelf: 'center',
        }}
        onClick={onScan}
        onMouseEnter={() => {
          onBoundaryHoverStart?.();
          onHelpHintChange?.(scanTooltipText);
        }}
        onMouseLeave={() => {
          onBoundaryHoverEnd?.();
          onHelpHintChange?.('');
        }}
      />
    </ActionButtonContainer>
  );
};

const SyncButtonWrapper: React.FC<Omit<SyncActionButtonsProps, 'mode'>> = ({
  auto,
  manualSyncTooltipText,
  autoSyncIcon,
  onManualSync,
  onAutoToggle,
  onHelpHintChange,
  onBoundaryHoverStart,
  onBoundaryHoverEnd,
}) => {
  const manualIcon = useMemo(() => createImportIcon(), []);
  const buttonWidth = ACTION_BUTTON_SIZE;
  const buttonHeight = SECTION_SIZE - ACTION_BUTTON_MARGIN * 2;

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (event.shiftKey) {
        event.preventDefault();
        onAutoToggle({
          altKey: event.altKey,
          shiftKey: event.shiftKey,
        });
        return;
      }
      onManualSync({
        altKey: event.altKey,
        shiftKey: event.shiftKey,
      });
    },
    [onAutoToggle, onManualSync],
  );

  const handleContextMenu = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      onAutoToggle({
        altKey: event.altKey,
        shiftKey: event.shiftKey,
      });
    },
    [onAutoToggle],
  );

  const manualHoverMessage = useMemo(
    () => `${manualSyncTooltipText} (+Shift自动模式)`,
    [manualSyncTooltipText],
  );

  return (
    <ActionButtonContainer align="stretch" justify="center">
      <SwitchButton
        type="primary"
        value={auto}
        style={{
          width: buttonWidth,
          height: buttonHeight,
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => {
          onHelpHintChange?.(manualHoverMessage);
          onBoundaryHoverStart?.();
        }}
        onMouseLeave={() => {
          onHelpHintChange?.('');
          onBoundaryHoverEnd?.();
        }}
        aria-label={manualHoverMessage}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          {manualIcon}
        </span>
        {auto ? (
          <span
            style={{
              position: 'absolute',
              bottom: 6,
              left: '50%',
              transform: 'translateX(-50%) scale(0.75)',
              transformOrigin: 'center',
              pointerEvents: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: 0.6,
              lineHeight: 1,
              opacity: 0.85,
            }}
          >
            {autoSyncIcon}
          </span>
        ) : null}
      </SwitchButton>
    </ActionButtonContainer>
  );
};

export const ActionButtons: React.FC<ActionButtonsProps> = props => {
  if (props.mode === 'selection') {
    const { mode, ...rest } = props;
    return <SelectionButtons {...rest} />;
  }

  const { mode, ...syncProps } = props;
  return <SyncButtonWrapper {...syncProps} />;
};
