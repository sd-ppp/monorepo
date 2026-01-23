import { Button, Flex, Tag, theme } from 'antd';
import React, { useMemo } from 'react';

import type { FileDropZoneHandlers } from '../../../hooks/useFileDropZone';
import { withAlpha } from '../../../utils/color';
import { ActionButtons, type ActionButtonsProps } from './ActionButtons';
import { AutoSyncColumn } from './AutoSyncColumn';
import { PreviewPanelPresentation } from './PreviewPanelPresentation';
import { ACTION_BUTTON_MARGIN, ACTION_BUTTON_SIZE, SECTION_SIZE } from './constants';
import type { ModeButtonDescriptor, SourceMode } from './types';

type PlaceholderActionAreaConfig = { mode: 'placeholder' };
type HiddenActionAreaConfig = { mode: 'hidden' };
type VisibleActionAreaConfig = ActionButtonsProps;

type ActionAreaConfig = PlaceholderActionAreaConfig | HiddenActionAreaConfig | VisibleActionAreaConfig;

type AutoSyncColumnConfig = React.ComponentProps<typeof AutoSyncColumn>;
type PreviewPanelConfig = React.ComponentProps<typeof PreviewPanelPresentation>;

interface StatusBarConfig {
  resolvedUploadingStatusMessage: string | null;
  isModeSelectionActive: boolean;
  modeButtons: ModeButtonDescriptor[];
  sourceMode: SourceMode;
  currentModeLabel: string;
  onModeChange: (mode: SourceMode) => void;
  onModeIconHoverStart: (mode: SourceMode) => void;
  onModeIconHoverEnd: () => void;
  onModeSelectionAreaEnter: () => void;
  onModeSelectionAreaLeave: () => void;
  shouldShowFileTag: boolean;
  fileTagLabel: string;
  fileTagResetHint: string;
  onFileTagReset: (event?: React.MouseEvent<HTMLElement>) => void;
  shouldShowAutoTag: boolean;
  autoStatusLabel: string;
  autoTagResetHint: string;
  onAutoToggle: () => void;
  statusBarLeftLabel: string;
  shouldShowStatusTags: boolean;
  hasCustomMask: boolean;
  maskTagResetHint: string;
  hasCustomBoundary: boolean;
  boundaryTagResetHint: string;
  onResetMask: (event?: React.MouseEvent<HTMLElement>) => void;
  onResetBoundary: (event?: React.MouseEvent<HTMLElement>) => void;
  onMaskStatusTagHoverStart: () => void;
  onMaskStatusTagHoverEnd: () => void;
  onBoundaryStatusTagHoverStart: () => void;
  onBoundaryStatusTagHoverEnd: () => void;
  hoverHelpMessage: string;
  maskTagLabel: string;
  boundaryTagLabel: string;
}

export interface ImageSelectorPresentationProps {
  dropHint: string;
  isDragging: boolean;
  dropHandlers: FileDropZoneHandlers;
  autoSyncColumn: AutoSyncColumnConfig;
  previewPanel: PreviewPanelConfig;
  actionArea: ActionAreaConfig;
  statusBar: StatusBarConfig;
}

export const ImageSelectorPresentation: React.FC<ImageSelectorPresentationProps> = ({
  dropHint,
  isDragging,
  dropHandlers,
  autoSyncColumn,
  previewPanel,
  actionArea,
  statusBar,
}) => {
  const { token } = theme.useToken();
  const dropOverlayBackground = useMemo(() => withAlpha(token.colorPrimary, 0.12), [token.colorPrimary]);
  const dropOverlayBorder = useMemo(() => withAlpha(token.colorPrimary, 0.55), [token.colorPrimary]);
  const dropOverlayText = token.colorText;
  const actionAreaWidth = ACTION_BUTTON_SIZE + ACTION_BUTTON_MARGIN * 2;

  const renderActionArea = () => {
    if (actionArea.mode === 'hidden') {
      return null;
    }

    if (actionArea.mode === 'placeholder') {
      return (
        <div
          style={{
            flex: '0 0 auto',
            width: actionAreaWidth,
            height: '100%',
          }}
        />
      );
    }

    return <ActionButtons {...actionArea} />;
  };

  const renderStatusBar = () => {
    if (statusBar.resolvedUploadingStatusMessage) {
      return (
        <span
          style={{
            flex: 1,
            minWidth: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {statusBar.resolvedUploadingStatusMessage}
        </span>
      );
    }

    if (statusBar.isModeSelectionActive) {
      return (
        <>
          <div
            onMouseEnter={statusBar.onModeSelectionAreaEnter}
            onMouseLeave={statusBar.onModeSelectionAreaLeave}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flex: 1,
              minWidth: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                gap: 6,
              }}
            >
              {statusBar.modeButtons.map(({ mode, icon: InactiveIcon, activeIcon, label, tooltip }) => {
                const isActive = statusBar.sourceMode === mode;
                const IconComponent = isActive && activeIcon ? activeIcon : InactiveIcon;
                const iconColor = isActive ? token.colorPrimary : token.colorText;
                return (
                  <Button
                    key={mode}
                    type={isActive ? 'default' : 'text'}
                    shape="circle"
                    size="small"
                    onClick={() => statusBar.onModeChange(mode)}
                    onMouseEnter={() => statusBar.onModeIconHoverStart(mode)}
                    onMouseLeave={statusBar.onModeIconHoverEnd}
                    aria-pressed={isActive}
                    aria-label={label}
                    title={tooltip}
                    style={{
                      width: 24,
                      height: 24,
                      padding: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: iconColor,
                    }}
                    icon={<IconComponent size={14} strokeWidth={2} color={iconColor} />}
                  />
                );
              })}
            </div>
            <span
              style={{
                whiteSpace: 'nowrap',
                color: token.colorText,
                textTransform: 'none',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {statusBar.currentModeLabel}
            </span>
          </div>
          <div
            style={{ flex: '0 0 auto' }}
            onMouseEnter={statusBar.onModeSelectionAreaEnter}
            onMouseLeave={statusBar.onModeSelectionAreaLeave}
          />
        </>
      );
    }

    return (
      <>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          {statusBar.shouldShowFileTag ? (
            <Tag
              closable
              style={{ margin: 0, cursor: 'pointer' }}
              onClick={statusBar.onFileTagReset}
              onClose={event => {
                event.preventDefault();
                statusBar.onFileTagReset(event);
              }}
              title={statusBar.fileTagResetHint}
            >
              {statusBar.fileTagLabel}
            </Tag>
          ) : null}
          {statusBar.shouldShowAutoTag ? (
            <Tag
              closable
              style={{ margin: 0, cursor: 'pointer' }}
              onClick={() => {
                statusBar.onAutoToggle();
              }}
              onClose={event => {
                event.preventDefault();
                statusBar.onAutoToggle();
              }}
              title={statusBar.autoTagResetHint}
            >
              {statusBar.autoStatusLabel}
            </Tag>
          ) : null}
          <span
            style={{
              flex: 1,
              minWidth: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {statusBar.statusBarLeftLabel || (statusBar.shouldShowFileTag ? '' : '\u00A0')}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flex: '0 0 auto',
            whiteSpace: 'nowrap',
          }}
        >
          {statusBar.shouldShowStatusTags ? (
            <>
              {statusBar.hasCustomMask ? (
                <Tag
                  closable
                  style={{ margin: 0, cursor: 'pointer' }}
                  onClick={statusBar.onResetMask}
                  onClose={statusBar.onResetMask}
                  onMouseEnter={() => {
                    statusBar.onMaskStatusTagHoverStart();
                  }}
                  onMouseLeave={() => {
                    statusBar.onMaskStatusTagHoverEnd();
                  }}
                  title={statusBar.maskTagResetHint}
                >
                  {statusBar.maskTagLabel}
                </Tag>
              ) : null}
              {statusBar.hasCustomBoundary ? (
                <Tag
                  closable
                  style={{ margin: 0, cursor: 'pointer' }}
                  onClick={statusBar.onResetBoundary}
                  onClose={statusBar.onResetBoundary}
                  onMouseEnter={statusBar.onBoundaryStatusTagHoverStart}
                  onMouseLeave={statusBar.onBoundaryStatusTagHoverEnd}
                  title={statusBar.boundaryTagResetHint}
                >
                  {statusBar.boundaryTagLabel}
                </Tag>
              ) : null}
            </>
          ) : null}
          {statusBar.hoverHelpMessage ? (
            <span
              style={{
                color: token.colorTextSecondary ?? token.colorText,
              }}
            >
              {statusBar.hoverHelpMessage}
            </span>
          ) : null}
        </div>
      </>
    );
  };

  return (
    <Flex vertical style={{ width: '100%' }} gap={0}>
      <div
        style={{
          width: '100%',
          border: `1px solid ${token.colorBorder}`,
          borderRadius: 6,
          overflow: 'hidden',
        }}
      >
        <Flex
          style={{
            width: '100%',
            minHeight: SECTION_SIZE,
            height: SECTION_SIZE,
            position: 'relative',
          }}
          align="stretch"
          gap={0}
          {...dropHandlers}
        >
          {isDragging ? (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: dropOverlayBackground,
                border: `2px dashed ${dropOverlayBorder}`,
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: dropOverlayText,
                fontSize: 14,
                fontWeight: 500,
                letterSpacing: 0.5,
                pointerEvents: 'none',
                backdropFilter: 'blur(1px)',
                zIndex: 5,
                textAlign: 'center',
                padding: '0 24px',
              }}
            >
              {dropHint}
            </div>
          ) : null}
          <AutoSyncColumn {...autoSyncColumn} />
          <PreviewPanelPresentation {...previewPanel} />
          {renderActionArea()}
        </Flex>
        <div
          style={{
            height: 28,
            borderTop: `1px solid ${token.colorBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 12px',
            gap: 12,
            boxSizing: 'border-box',
            color: token.colorText,
            fontSize: 12,
            lineHeight: '28px',
          }}
        >
          {renderStatusBar()}
        </div>
      </div>
    </Flex>
  );
};
