import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyncButton } from './SyncButton';
import { ConfigProvider } from 'antd';
import { RefreshCw } from 'lucide-react';

const mockOnSync = vi.fn();
const mockOnAutoSyncToggle = vi.fn();

const defaultProps = {
  disabled: false,
  isAutoSync: false,
  onSync: mockOnSync,
  onAutoSyncToggle: mockOnAutoSyncToggle,
  children: 'Sync',
};

const renderComponent = (props = {}) => {
  return render(
    <ConfigProvider>
      <SyncButton {...defaultProps} {...props} />
    </ConfigProvider>
  );
};

describe('SyncButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it('should render the main sync button by default', () => {
    renderComponent();
    expect(screen.getByTestId('sync-button-main')).toBeInTheDocument();
  });

  it('should be disabled when disabled prop is true', () => {
    renderComponent({ disabled: true });
    expect(screen.getByTestId('sync-button-main')).toBeDisabled();
    expect(screen.getByTestId('sync-button-auto-sync')).toBeDisabled();
  });

  it('should call onSync with modifier keys', () => {
    renderComponent();
    const mainButton = screen.getByTestId('sync-button-main');

    fireEvent.click(mainButton);
    expect(mockOnSync).toHaveBeenLastCalledWith({ altKey: false, shiftKey: false });

    fireEvent.click(mainButton, { shiftKey: true });
    expect(mockOnSync).toHaveBeenLastCalledWith({ altKey: false, shiftKey: true });

    fireEvent.click(mainButton, { altKey: true });
    expect(mockOnSync).toHaveBeenLastCalledWith({ altKey: true, shiftKey: false });

    expect(mockOnSync).toHaveBeenCalledTimes(3);
  });

  describe('auto-sync functionality', () => {
    it('should render the auto-sync button by default', () => {
      renderComponent();
      expect(screen.getByTestId('sync-button-auto-sync')).toBeInTheDocument();
    });

    it('should call onAutoSyncToggle with modifier keys', () => {
      renderComponent();
      const autoSyncButton = screen.getByTestId('sync-button-auto-sync');

      fireEvent.click(autoSyncButton, { altKey: true, shiftKey: true });
      expect(mockOnAutoSyncToggle).toHaveBeenCalledWith({ altKey: true, shiftKey: true });
    });

    it('should not render the auto-sync button when autoSyncEnabled is false', () => {
      renderComponent({ autoSyncEnabled: false });
      expect(screen.queryByTestId('sync-button-auto-sync')).not.toBeInTheDocument();
    });

    it('should render a custom auto-sync icon', () => {
      const CustomIcon = ({ spin, ...props }: { spin?: boolean, [key: string]: any }) => (
        <div {...props} data-testid="custom-icon" data-spinning={spin || false} />
      );
      renderComponent({ autoSyncIcon: <CustomIcon /> });
      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });

    it('should apply spin animation to the icon when isAutoSync is true', () => {
      const { rerender } = renderComponent({ isAutoSync: false, autoSyncIcon: <RefreshCw /> });
      const autoSyncButton = screen.getByTestId('sync-button-auto-sync');
      let icon = autoSyncButton.querySelector('.sync-button-auto-icon');
      expect(icon?.getAttribute('data-spinning')).toBeNull();
      expect(icon).not.toHaveClass('sync-button-auto-icon--spinning');

      rerender(
        <ConfigProvider>
          <SyncButton {...defaultProps} isAutoSync={true} autoSyncIcon={<RefreshCw />} />
        </ConfigProvider>
      );

      icon = screen.getByTestId('sync-button-auto-sync').querySelector('.sync-button-auto-icon');
      expect(icon?.getAttribute('data-spinning')).toBe('true');
      expect(icon).toHaveClass('sync-button-auto-icon--spinning');
    });
  });

  describe('tooltips', () => {
    it('should show tooltip for main sync button on hover', async () => {
      const user = userEvent.setup();
      renderComponent({ syncButtonTooltip: 'Sync now!' });
      
      const mainButton = screen.getByTestId('sync-button-main');
      await user.hover(mainButton);
      
      expect(await screen.findByRole('tooltip', { name: 'Sync now!' })).toBeInTheDocument();
    });

    it('should show correct tooltip for auto-sync button based on state', async () => {
      const user = userEvent.setup();
      const tooltips = { enabled: 'Auto-sync is ON', disabled: 'Auto-sync is OFF' };
      const { rerender } = renderComponent({ 
        isAutoSync: false,
        autoSyncButtonTooltips: tooltips 
      });

      const autoSyncButton = screen.getByTestId('sync-button-auto-sync');
      await user.hover(autoSyncButton);
      expect(await screen.findByRole('tooltip', { name: 'Auto-sync is OFF' })).toBeInTheDocument();
      await user.unhover(autoSyncButton);

      rerender(
        <ConfigProvider>
          <SyncButton {...defaultProps} isAutoSync={true} autoSyncButtonTooltips={tooltips} />
        </ConfigProvider>
      );
      
      await user.hover(screen.getByTestId('sync-button-auto-sync'));
      expect(await screen.findByRole('tooltip', { name: 'Auto-sync is ON' })).toBeInTheDocument();
    });

    it('should not render tooltip if prop is not provided', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      const mainButton = screen.getByTestId('sync-button-main');
      await user.hover(mainButton);

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  describe('descText (inside button)', () => {
    it('renders secondary description text inside the main button when provided', () => {
      renderComponent({ descText: 'This is a description' });
      const desc = screen.getByTestId('sync-button-desc');
      expect(desc).toBeInTheDocument();
      const mainButton = screen.getByTestId('sync-button-main');
      expect(mainButton.contains(desc)).toBe(true);
    });
    
    it('uses vertical flex layout inside the button', () => {
      renderComponent({ descText: 'Flex layout' });
      const content = screen.getByTestId('sync-button-content');
      expect(content).toHaveStyle({ display: 'flex' });
      const mainContent = screen.getByTestId('sync-button-main-content');
      expect(mainContent).toHaveStyle({ height: '50%' });
      const descContainer = screen.getByTestId('sync-button-desc-container');
      expect(descContainer).toHaveStyle({ height: '50%' });
    });

    it('centers main content vertically when descText is absent', () => {
      renderComponent();
      const mainContent = screen.getByTestId('sync-button-main-content');
      expect(mainContent).toHaveStyle({ height: '100%' });
      expect(mainContent).toHaveStyle({ display: 'flex' });
      expect(mainContent).toHaveStyle({ alignItems: 'center' });
      expect(mainContent).toHaveStyle({ justifyContent: 'center' });
    });

    it('does not render descText when prop is not provided', () => {
      renderComponent();
      expect(screen.queryByTestId('sync-button-desc')).not.toBeInTheDocument();
    });

    it('maintains fixed button height at 28px (main and auto) and root line-height=1', () => {
      renderComponent({ descText: 'Check height', 'data-testid': 'sync-button-root' });
      const mainButton = screen.getByTestId('sync-button-main');
      expect(mainButton).toHaveStyle({ height: '28px' });
      const autoButton = screen.getByTestId('sync-button-auto-sync');
      expect(autoButton).toHaveStyle({ height: '28px' });
      const root = screen.getByTestId('sync-button-root');
      expect(root).toHaveStyle({ lineHeight: '1' });
    });
  });

  describe('layout variations', () => {
    it('renders vertical layout with auto button above main button', () => {
      renderComponent({ direction: 'vertical', buttonSize: 72, buttonSizeSub: 32, 'data-testid': 'sync-button-root' });
      const root = screen.getByTestId('sync-button-root');
      const buttons = root.querySelectorAll('button');
      expect(buttons[0]).toHaveAttribute('data-testid', 'sync-button-auto-sync');
      expect(buttons[1]).toHaveAttribute('data-testid', 'sync-button-main');
    });

    it('renders only the main button when auto sync is disabled in vertical layout', () => {
      renderComponent({ direction: 'vertical', autoSyncEnabled: false });
      expect(screen.queryByTestId('sync-button-auto-sync')).not.toBeInTheDocument();
      expect(screen.getByTestId('sync-button-main')).toBeInTheDocument();
    });

    it('applies width when buttonSize is provided in horizontal layout', () => {
      renderComponent({ buttonSize: 180, buttonSizeSub: 36, 'data-testid': 'sync-button-root' });
      const root = screen.getByTestId('sync-button-root');
      const compact = root.querySelector('.ant-space-compact');
      expect(compact).not.toBeNull();
      expect(compact).toHaveStyle({ width: '180px' });
      expect(compact).toHaveStyle({ height: '36px' });
    });

    it('applies height when buttonSize is provided in vertical layout', () => {
      renderComponent({ direction: 'vertical', buttonSize: 72, buttonSizeSub: 32, 'data-testid': 'sync-button-root' });
      const mainButton = screen.getByTestId('sync-button-main');
      expect(mainButton).toHaveStyle({ height: '44px' });
      const autoButton = screen.getByTestId('sync-button-auto-sync');
      expect(autoButton).toHaveStyle({ height: '28px' });
      expect(autoButton).toHaveStyle({ width: '32px' });
      const compact = screen.getByTestId('sync-button-root').querySelector('.ant-space-compact');
      expect(compact).not.toBeNull();
      expect(compact).toHaveStyle({ width: '32px' });
      expect(compact).toHaveStyle({ height: '72px' });
    });

    it('collapses to auto button when collapseToAutoWhenEnabled is true and auto sync is active', () => {
      renderComponent({
        collapseToAutoWhenEnabled: true,
        isAutoSync: true,
        autoSyncEnabled: true,
        buttonSize: 120,
        buttonSizeSub: 40,
        'data-testid': 'sync-button-root',
      });
      expect(screen.queryByTestId('sync-button-main')).not.toBeInTheDocument();
      const autoButton = screen.getByTestId('sync-button-auto-sync');
      expect(autoButton).toBeInTheDocument();
      const compact = screen.getByTestId('sync-button-root').querySelector('.ant-space-compact');
      expect(compact).toHaveStyle({ height: '40px' });
      expect(compact).toHaveStyle({ width: '28px' });
    });

    it('does not collapse when auto sync is inactive despite collapseToAutoWhenEnabled', () => {
      renderComponent({
        collapseToAutoWhenEnabled: true,
        isAutoSync: false,
        autoSyncEnabled: true,
        buttonSizeSub: 40,
      });
      expect(screen.getByTestId('sync-button-main')).toBeInTheDocument();
      expect(screen.getByTestId('sync-button-auto-sync')).toBeInTheDocument();
    });
  });
});
