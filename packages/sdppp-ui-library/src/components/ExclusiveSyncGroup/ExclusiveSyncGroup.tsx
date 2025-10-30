import React, { useState, useCallback } from 'react';
import { Space } from 'antd';
import type { TooltipPlacement } from 'antd/es/tooltip';
import { SyncButton } from '../SyncButton/SyncButton';

export interface ButtonConfig {
  id: string;
  text: string;
  supportsAutoSync: boolean;
  syncButtonTooltip?: React.ReactNode;
  autoSyncButtonTooltips?: {
    enabled: React.ReactNode;
    disabled: React.ReactNode;
  };
  descText?: string;
}

interface ModifierKeyEvent {
  altKey: boolean;
  shiftKey: boolean;
}

export interface ExclusiveSyncGroupProps {
  buttons: ButtonConfig[];
  onSync: (id: string, event: ModifierKeyEvent) => Promise<void>;
  onAutoSyncChange?: (activeId: string | null, event: ModifierKeyEvent) => void;
  buttonWidth?: number | string;
  // Controlled/Uncontrolled support for auto active id
  activeAutoSyncId?: string | null;
  defaultActiveAutoSyncId?: string | null;
  tooltipPlacement?: TooltipPlacement;
  autoTooltipPlacement?: TooltipPlacement;
}

export const ExclusiveSyncGroup: React.FC<ExclusiveSyncGroupProps> = ({
  buttons,
  onSync,
  onAutoSyncChange,
  buttonWidth,
  activeAutoSyncId: activeAutoSyncIdProp,
  defaultActiveAutoSyncId = null,
  tooltipPlacement,
  autoTooltipPlacement,
}) => {
  const [syncingStates, setSyncingStates] = useState<Record<string, boolean>>({});
  const [activeAutoSyncIdState, setActiveAutoSyncIdState] = useState<string | null>(defaultActiveAutoSyncId);

  const isControlled = activeAutoSyncIdProp !== undefined;
  const activeAutoSyncId = isControlled ? activeAutoSyncIdProp! : activeAutoSyncIdState;

  const isAnyButtonSyncing = Object.values(syncingStates).some(isSyncing => isSyncing);

  const handleSync = useCallback(async (id: string, event: ModifierKeyEvent) => {
    if (isAnyButtonSyncing) return;

    if (id !== activeAutoSyncId) {
      if (activeAutoSyncId !== null) {
        if (!isControlled) setActiveAutoSyncIdState(null);
        onAutoSyncChange?.(null, event);
      }
    }

    setSyncingStates(prev => ({ ...prev, [id]: true }));
    try {
      await onSync(id, event);
    } finally {
      setSyncingStates(prev => ({ ...prev, [id]: false }));
    }
  }, [activeAutoSyncId, onSync, onAutoSyncChange, isAnyButtonSyncing, isControlled]);

  const handleAutoSyncToggle = useCallback((id: string, event: ModifierKeyEvent) => {
    if (isAnyButtonSyncing) return;

    const nextActiveId = activeAutoSyncId === id ? null : id;
    if (!isControlled) setActiveAutoSyncIdState(nextActiveId);
    onAutoSyncChange?.(nextActiveId, event);
  }, [activeAutoSyncId, onAutoSyncChange, isAnyButtonSyncing, isControlled]);

  return (
    <Space direction="vertical" size={6}>
      {buttons.map(config => (
        <SyncButton
          key={config.id}
          buttonWidth={buttonWidth}
          data-testid={`sync-button-${config.id}`}
          disabled={isAnyButtonSyncing}
          isAutoSync={activeAutoSyncId === config.id}
          onSync={(event) => handleSync(config.id, event)}
          onAutoSyncToggle={(event) => handleAutoSyncToggle(config.id, event)}
          autoSyncEnabled={config.supportsAutoSync}
          syncButtonTooltip={config.syncButtonTooltip}
          autoSyncButtonTooltips={config.autoSyncButtonTooltips}
          descText={config.descText}
          tooltipPlacement={tooltipPlacement}
          autoTooltipPlacement={autoTooltipPlacement}
        >
          {config.text}
        </SyncButton>
      ))}
    </Space>
  );
};
