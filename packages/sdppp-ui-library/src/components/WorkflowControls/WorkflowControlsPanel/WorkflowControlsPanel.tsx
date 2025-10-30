import type { CSSProperties, ReactNode } from 'react';
import '../WorkflowControlsPanel.less';

export interface ThreeColumnRowSlots {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
}

export interface WorkflowControlsPanelProps {
  className?: string;
  style?: CSSProperties;
  rowGap?: number;
  middleRowGap?: number;
  headerRow?: ThreeColumnRowSlots;
  bodyRow?: ThreeColumnRowSlots;
  middleTopRow?: ThreeColumnRowSlots;
  middleBottomRow?: ThreeColumnRowSlots;
}

const joinClassNames = (...classes: Array<string | undefined | false>) =>
  classes.filter(Boolean).join(' ');

const DEFAULT_GAP = 8;

const hasRowContent = (row?: ThreeColumnRowSlots) =>
  Boolean(row && (row.left || row.center || row.right));

interface WorkflowThreeColumnRowProps {
  row?: ThreeColumnRowSlots;
  columnGap: number;
  className?: string;
}

const WorkflowThreeColumnRow = ({
  row,
  columnGap,
  className,
}: WorkflowThreeColumnRowProps) => {
  if (!hasRowContent(row)) {
    return null;
  }

  return (
    <div
      className={joinClassNames('workflow-three-column-row', className)}
      style={{ columnGap }}
    >
      <div className="workflow-three-column-left">
        {row?.left}
      </div>
      <div className="workflow-three-column-center">
        {row?.center}
      </div>
      <div className="workflow-three-column-right">
        {row?.right}
      </div>
    </div>
  );
};

export const WorkflowControlsPanel = ({
  className,
  style,
  rowGap = DEFAULT_GAP,
  middleRowGap,
  headerRow,
  bodyRow,
  middleTopRow,
  middleBottomRow,
}: WorkflowControlsPanelProps) => {
  const resolvedMiddleRowGap = middleRowGap ?? rowGap;
  const hasMiddleTop = hasRowContent(middleTopRow);
  const hasMiddleBottom = hasRowContent(middleBottomRow);
  const hasMiddleSection = hasMiddleTop || hasMiddleBottom;

  const middleSection = hasMiddleSection ? (
    <div
      className="workflow-controls-middle-section"
      style={{ gap: resolvedMiddleRowGap }}
    >
      <WorkflowThreeColumnRow
        row={middleTopRow}
        columnGap={rowGap}
        className="workflow-controls-middle-top-row"
      />
      <WorkflowThreeColumnRow
        row={middleBottomRow}
        columnGap={0}
        className="workflow-controls-middle-bottom-row"
      />
    </div>
  ) : null;

  const centerContent = middleSection
    ? (
      <div
        className="workflow-controls-middle-stack"
        style={{ gap: resolvedMiddleRowGap }}
      >
        {bodyRow?.center}
        {middleSection}
      </div>
    )
    : bodyRow?.center;

  const composedBodyRow: ThreeColumnRowSlots | undefined =
    hasRowContent(bodyRow) || hasMiddleSection ? {
      left: bodyRow?.left,
      center: centerContent,
      right: bodyRow?.right,
    } : undefined;

  const hasHeader = hasRowContent(headerRow);
  const hasBody = hasRowContent(composedBodyRow);

  return (
    <div
      className={joinClassNames('workflow-controls-panel', className)}
      style={style}
    >
      {hasHeader ? (
        <div className="workflow-controls-header">
          <WorkflowThreeColumnRow
            row={headerRow}
            columnGap={rowGap}
            className="workflow-controls-header-row"
          />
        </div>
      ) : null}
      {hasBody ? (
        <div className="workflow-controls-body">
          <WorkflowThreeColumnRow
            row={composedBodyRow}
            columnGap={rowGap}
            className="workflow-controls-body-row"
          />
        </div>
      ) : null}
    </div>
  );
};
