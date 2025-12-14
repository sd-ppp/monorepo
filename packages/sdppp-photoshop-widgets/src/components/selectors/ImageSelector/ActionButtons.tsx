import { SyncButton } from '@sdppp/ui-library';
import { Button } from 'antd';
import { Crop, Import as ImportIcon, Scissors } from 'lucide-react';
import React, { useMemo } from 'react';

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
  autoButtonTooltip,
  manualSyncTooltipText,
  autoSyncIcon,
  onManualSync,
  onAutoToggle,
  onHelpHintChange,
  onBoundaryHoverStart,
  onBoundaryHoverEnd,
}) => {
  const manualIcon = useMemo(() => createImportIcon(), []);
  const buttonHeight = SECTION_SIZE - ACTION_BUTTON_MARGIN * 2;

  return (
    <ActionButtonContainer align="stretch" justify="center">
      <SyncButton
        disabled={false}
        mainButtonDisabled={false}
        isAutoSync={auto}
        onSync={event => {
          onManualSync(event);
        }}
        onAutoSyncToggle={event => {
        onAutoToggle(event);
      }}
      direction="vertical"
      autoSyncEnabled={true}
      buttonSize={buttonHeight}
        buttonSizeSub={ACTION_BUTTON_SIZE}
        mainButtonType="primary"
        autoSyncIcon={autoSyncIcon}
        autoSyncButtonTooltips={{
          enabled: autoButtonTooltip,
          disabled: autoButtonTooltip,
        }}
        syncButtonTooltip={manualSyncTooltipText}
        style={{ margin: 0 }}
        onMouseEnter={() => {
          onHelpHintChange?.(manualSyncTooltipText);
          onBoundaryHoverStart?.();
        }}
        onMouseLeave={() => {
          onHelpHintChange?.('');
          onBoundaryHoverEnd?.();
        }}
      >
        {manualIcon}
      </SyncButton>
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
