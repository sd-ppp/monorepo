import { Progress, Typography } from 'antd';
import type { CSSProperties, ReactNode } from 'react';

const { Text } = Typography;

export type WorkflowStatusDescriptor =
  | { type: 'uploading'; message?: ReactNode; showIcon?: boolean }
  | { type: 'error'; message: ReactNode; showIcon?: boolean }
  | { type: 'progress'; message?: ReactNode; percent: number; showInfo?: boolean }
  | { type: 'autoRunning'; message: ReactNode }
  | { type: 'text'; message: ReactNode; tone?: 'default' | 'secondary' }
  | { type: 'empty' };

export interface WorkflowStatusDisplayProps {
  status: WorkflowStatusDescriptor;
  className?: string;
  style?: CSSProperties;
  uploadingFallback?: ReactNode;
}

export const WorkflowStatusDisplay = ({
  status,
  className,
  style,
  uploadingFallback,
}: WorkflowStatusDisplayProps) => {
  switch (status.type) {
    case 'uploading':
      return (
        <Text
          className={className}
          style={style}
          ellipsis={{ tooltip: true }}
          type="secondary"
        >
          {status.message ?? uploadingFallback ?? null}
        </Text>
      );
    case 'error':
      return (
        <Text
          className={className}
          style={style}
          ellipsis={{ tooltip: true }}
          type="danger"
        >
          {status.message}
        </Text>
      );
    case 'progress':
      return (
        <div
          className={className}
          style={{ display: 'flex', flexDirection: 'column', gap: 0, ...style }}
        >
          {status.message ? (
            <Text
              ellipsis={{ tooltip: true }}
              style={{ margin: 0, fontSize: 12 }}
            >
              {status.message}
            </Text>
          ) : null}
          <Progress
            percent={status.percent}
            size="small"
            showInfo={status.showInfo ?? false}
            style={{ margin: 0, marginTop: -8 }}
          />
        </div>
      );
    case 'autoRunning':
      return (
        <Text className={className} style={style} type="secondary">
          {status.message}
        </Text>
      );
    case 'text':
      return (
        <Text
          className={className}
          style={style}
          type={status.tone === 'secondary' ? 'secondary' : undefined}
          ellipsis={{ tooltip: typeof status.message === 'string' }}
        >
          {status.message}
        </Text>
      );
    case 'empty':
    default:
      return null;
  }
};
