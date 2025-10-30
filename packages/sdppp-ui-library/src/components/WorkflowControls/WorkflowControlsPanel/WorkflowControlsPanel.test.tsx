import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { WorkflowControlsPanel } from './WorkflowControlsPanel';
import { ConfigProvider } from 'antd';

const renderPanel = (props: React.ComponentProps<typeof WorkflowControlsPanel>) =>
  render(
    <ConfigProvider>
      <WorkflowControlsPanel {...props} />
    </ConfigProvider>
  );

describe('WorkflowControlsPanel', () => {
  it('renders header slots and body slots when provided', () => {
    renderPanel({
      headerRow: {
        left: <div data-testid="header-left">left</div>,
        center: <div data-testid="header-center">header</div>,
        right: <div data-testid="header-right">right</div>,
      },
      bodyRow: {
        left: <div data-testid="body-left">L</div>,
        right: <div data-testid="body-right">R</div>,
      },
      middleTopRow: {
        left: <div data-testid="middle-top-left">TL</div>,
        center: <div data-testid="middle-top-center">TC</div>,
        right: <div data-testid="middle-top-right">TR</div>,
      },
      middleBottomRow: {
        left: <div data-testid="middle-bottom-left">BL</div>,
        center: <div data-testid="middle-bottom-center">BC</div>,
        right: <div data-testid="middle-bottom-right">BR</div>,
      },
    });

    expect(screen.getByTestId('header-center')).toBeInTheDocument();
    expect(screen.getByTestId('header-left')).toBeInTheDocument();
    expect(screen.getByTestId('header-right')).toBeInTheDocument();
    expect(screen.getByTestId('body-left')).toBeInTheDocument();
    expect(screen.getByTestId('body-right')).toBeInTheDocument();
    expect(screen.getByTestId('middle-top-left')).toBeInTheDocument();
    expect(screen.getByTestId('middle-top-center')).toBeInTheDocument();
    expect(screen.getByTestId('middle-top-right')).toBeInTheDocument();
    expect(screen.getByTestId('middle-bottom-left')).toBeInTheDocument();
    expect(screen.getByTestId('middle-bottom-center')).toBeInTheDocument();
    expect(screen.getByTestId('middle-bottom-right')).toBeInTheDocument();
  });

  it('omits sections when rows are not provided', () => {
    renderPanel({
      middleBottomRow: {
        center: <div data-testid="middle-only">middle</div>,
      },
    });

    expect(screen.getByTestId('middle-only')).toBeInTheDocument();
    expect(screen.queryByTestId('header-left')).not.toBeInTheDocument();
    expect(screen.queryByTestId('body-left')).not.toBeInTheDocument();
    expect(screen.queryByTestId('middle-top-left')).not.toBeInTheDocument();
  });
});
