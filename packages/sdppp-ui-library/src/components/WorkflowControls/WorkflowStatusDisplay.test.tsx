import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { WorkflowStatusDisplay } from './WorkflowStatusDisplay';
import { ConfigProvider } from 'antd';

const renderStatus = (status: React.ComponentProps<typeof WorkflowStatusDisplay>['status']) =>
  render(
    <ConfigProvider>
      <WorkflowStatusDisplay status={status} />
    </ConfigProvider>
  );

describe('WorkflowStatusDisplay', () => {
  it('renders uploading alert', () => {
    renderStatus({ type: 'uploading', message: 'Uploading assets' });
    expect(screen.getByText('Uploading assets')).toBeInTheDocument();
  });

  it('renders progress information', () => {
    renderStatus({ type: 'progress', message: 'Processing', percent: 42 });
    expect(screen.getByText('Processing')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders secondary text', () => {
    renderStatus({ type: 'text', message: 'Idle', tone: 'secondary' });
    expect(screen.getByText('Idle')).toBeInTheDocument();
  });
});
