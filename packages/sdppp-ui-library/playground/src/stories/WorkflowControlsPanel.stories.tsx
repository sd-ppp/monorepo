import {
  ArrowLeftOutlined,
  CloseCircleOutlined,
  ForwardOutlined,
  PlayCircleFilled,
  ReloadOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import {
  WorkflowControlsPanel,
  WorkflowStatusDisplay,
} from '@sdppp/ui-library';
import type { Meta, StoryObj } from '@storybook/react';
import { Button, Form, InputNumber, Modal, Segmented, Tooltip, Typography } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState, type FC } from 'react';

const meta: Meta<typeof WorkflowControlsPanel> = {
  title: 'Components/WorkflowControlsPanel',
  component: WorkflowControlsPanel,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    headerRow: { control: false },
    bodyRow: { control: false },
    middleTopRow: { control: false },
    middleBottomRow: { control: false },
  },
};

export default meta;

type Story = StoryObj<typeof WorkflowControlsPanel>;

type StatusKey = 'text' | 'uploading' | 'progress' | 'error';

const STATUS_SEQUENCE: StatusKey[] = ['text', 'uploading', 'progress', 'error'];
const HOVER_EXIT_DELAY_MS = 200;

const DemoPanel: FC = () => {
  const { Text } = Typography;
  const [isAutoRun, setIsAutoRun] = useState(false);
  const [disabledMultiplier, setDisabledMultiplier] = useState<number | null>(null);
  const [isPreviewHoverActive, setIsPreviewHoverActive] = useState(false);
  const [isPreviewHoverVisible, setIsPreviewHoverVisible] = useState(false);
  const [isRunHoverVisible, setIsRunHoverVisible] = useState(false);
  const [isRunButtonsHovering, setIsRunButtonsHovering] = useState(false);
  const [isScaleModalOpen, setIsScaleModalOpen] = useState(false);
  const [pixelWidth, setPixelWidth] = useState(2048);
  const [coveragePercent, setCoveragePercent] = useState(100);
  const [statusKey, setStatusKey] = useState<StatusKey>('text');
  const [form] = Form.useForm();
  const previewHoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runHoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cycleStatus = useCallback(() => {
    setStatusKey((current) => {
      const index = STATUS_SEQUENCE.indexOf(current);
      const nextIndex = (index + 1) % STATUS_SEQUENCE.length;
      return STATUS_SEQUENCE[nextIndex];
    });
  }, []);

  const resetStatus = useCallback(() => {
    setStatusKey('text');
  }, []);

  const simulateRun = useCallback(() => {
    resetStatus();
    setDisabledMultiplier(1);
    setTimeout(() => setDisabledMultiplier(null), 600);
  }, [resetStatus]);

  const triggerMultiRun = useCallback((multi: number) => {
    cycleStatus();
    setDisabledMultiplier(multi);
    setTimeout(() => setDisabledMultiplier(null), 600);
  }, [cycleStatus]);

  const PREVIEW_SIZE = 81;
  const ACTION_SIZE = 32;

  const clearPreviewHoverTimeout = useCallback(() => {
    if (previewHoverTimeoutRef.current) {
      clearTimeout(previewHoverTimeoutRef.current);
      previewHoverTimeoutRef.current = null;
    }
  }, []);

  const showPreviewHover = useCallback(() => {
    clearPreviewHoverTimeout();
    setIsPreviewHoverActive(true);
    setIsPreviewHoverVisible(true);
  }, [clearPreviewHoverTimeout]);

  const hidePreviewHover = useCallback(() => {
    setIsPreviewHoverActive(false);
    clearPreviewHoverTimeout();
    previewHoverTimeoutRef.current = setTimeout(() => {
      setIsPreviewHoverVisible(false);
      previewHoverTimeoutRef.current = null;
    }, HOVER_EXIT_DELAY_MS);
  }, [clearPreviewHoverTimeout]);

  const clearRunHoverTimeout = useCallback(() => {
    if (runHoverTimeoutRef.current) {
      clearTimeout(runHoverTimeoutRef.current);
      runHoverTimeoutRef.current = null;
    }
  }, []);

  const showRunHover = useCallback(() => {
    clearRunHoverTimeout();
    setIsRunHoverVisible(true);
  }, [clearRunHoverTimeout]);

  const hideRunHover = useCallback(() => {
    clearRunHoverTimeout();
    runHoverTimeoutRef.current = setTimeout(() => {
      setIsRunHoverVisible(false);
      runHoverTimeoutRef.current = null;
    }, HOVER_EXIT_DELAY_MS);
  }, [clearRunHoverTimeout]);

  const handleRunButtonsMouseEnter = useCallback(() => {
    setIsRunButtonsHovering(true);
    showRunHover();
  }, [showRunHover]);

  const handleRunButtonsMouseLeave = useCallback(() => {
    setIsRunButtonsHovering(false);
    hideRunHover();
  }, [hideRunHover]);

  const headerLeftSlot = useMemo(() => (
    <Tooltip title="返回列表">
      <Button
        size="large"
        icon={<ArrowLeftOutlined />}
        onClick={() => console.log('Back')}
        data-testid="storybook-back"
        style={{ width: ACTION_SIZE, height: ACTION_SIZE, borderRadius: 8 }}
      />
    </Tooltip>
  ), []);

  const headerRightSlot = useMemo(() => (
    <div className="workflow-controls-actions">
      <Tooltip title="保存工作流">
        <Button
        size="large"
        icon={<SaveOutlined />}
        onClick={() => console.log('Save workflow')}
        style={{ width: ACTION_SIZE, height: ACTION_SIZE, borderRadius: 8 }}
        />
      </Tooltip>
      <Tooltip title="重载节点">
        <Button
        size="large"
        icon={<ReloadOutlined />}
        onClick={cycleStatus}
        style={{ width: ACTION_SIZE, height: ACTION_SIZE, borderRadius: 8 }}
        />
      </Tooltip>
    </div>
  ), [cycleStatus]);

  const middleTopSlot = useMemo(() => (
    <div className="workflow-controls-actions">
      <Tooltip title="停止所有任务">
        <Button
        size="large"
        danger
        icon={<CloseCircleOutlined />}
        onClick={() => console.log('Stop all')}
        style={{ width: ACTION_SIZE, height: ACTION_SIZE, borderRadius: 8 }}
        />
      </Tooltip>
      <Tooltip title={isAutoRun ? '停止自动运行' : '开启自动运行'}>
        <Button
        size="large"
        type={isAutoRun ? 'primary' : 'default'}
        icon={<ForwardOutlined />}
        onClick={() => setIsAutoRun((value) => !value)}
        style={{ width: ACTION_SIZE, height: ACTION_SIZE, borderRadius: 8 }}
        />
      </Tooltip>
    </div>
  ), [isAutoRun]);

  const statusDescriptor = useMemo(() => {
    switch (statusKey) {
      case 'uploading':
        return { type: 'uploading', message: '正在上传素材…', showIcon: true } as const;
      case 'progress':
        return { type: 'progress', percent: 48, message: '队列中还有 2 个任务…', showInfo: false } as const;
      case 'error':
        return { type: 'error', message: '连接中断，请重试', showIcon: true } as const;
      case 'text':
      default:
        return { type: 'text', tone: 'secondary', message: 'workflow/example.json' } as const;
    }
  }, [statusKey]);

  const persistentStatus = useMemo(() => {
    if (statusDescriptor.type === 'text' || statusDescriptor.type === 'empty') {
      return null;
    }
    return (
      <WorkflowStatusDisplay
        status={statusDescriptor}
        style={{ width: '100%' }}
      />
    );
  }, [statusDescriptor]);

  const rightSlot = useMemo(() => (
    <Tooltip title="立即运行">
      <Button
        type="primary"
        size="large"
        icon={<PlayCircleFilled />}
        style={{
          width: PREVIEW_SIZE,
          height: PREVIEW_SIZE,
          fontSize: 32,
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={simulateRun}
        disabled={disabledMultiplier === 1}
        onMouseEnter={showRunHover}
        onMouseLeave={hideRunHover}
      />
    </Tooltip>
  ), [disabledMultiplier, hideRunHover, showRunHover, simulateRun]);

  const runMultiplierButtons = useMemo(() => (
    <div
      className="workflow-controls-secondary-row"
      onMouseEnter={handleRunButtonsMouseEnter}
      onMouseLeave={handleRunButtonsMouseLeave}
    >
      <Button
        className="workflow-secondary-button"
        style={{ width: 25, height: 25, fontSize: 8, padding: 0, minWidth: 24 }}
        onClick={() => triggerMultiRun(2)}
        disabled={disabledMultiplier === 2}
      >
        x2
      </Button>
      <Button
        className="workflow-secondary-button"
        style={{ width: 25, height: 25, fontSize: 8, padding: 0, minWidth: 24 }}
        onClick={() => triggerMultiRun(5)}
        disabled={disabledMultiplier === 5}
      >
        x5
      </Button>
      <Button
        className="workflow-secondary-button"
        style={{ width: 25, height: 25, fontSize: 8, padding: 0, minWidth: 24 }}
        onClick={() => triggerMultiRun(9)}
        disabled={disabledMultiplier === 9}
      >
        x9
      </Button>
    </div>
  ), [disabledMultiplier, triggerMultiRun]);

  const openScaleModal = useCallback(() => {
    form.setFieldsValue({
      pixelWidth,
      coveragePercent,
    });
    setIsScaleModalOpen(true);
  }, [coveragePercent, form, pixelWidth]);

  const closeScaleModal = useCallback(() => {
    setIsScaleModalOpen(false);
  }, []);

  const handleScaleSubmit = useCallback(async () => {
    const values = await form.validateFields();
    setPixelWidth(values.pixelWidth);
    setCoveragePercent(values.coveragePercent);
    setIsScaleModalOpen(false);
  }, [form]);

  const headerRow = useMemo(() => ({
    left: headerLeftSlot,
    center: <Text strong>workflow/example.json</Text>,
    right: headerRightSlot,
  }), [Text, headerLeftSlot, headerRightSlot]);

  const bodyRow = useMemo(() => ({
    left: (
      <div
        onMouseEnter={showPreviewHover}
        onMouseLeave={hidePreviewHover}
        style={{
          width: PREVIEW_SIZE,
          height: PREVIEW_SIZE,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 600,
          fontSize: 12,
          color: 'white',
          background: 'linear-gradient(135deg, #9254de 0%, #13c2c2 100%)',
          borderRadius: 8,
          cursor: 'pointer',
          transform: isPreviewHoverActive ? 'scale(1.08)' : 'scale(1)',
          boxShadow: isPreviewHoverActive ? '0 12px 24px rgba(19, 194, 194, 0.35)' : 'none',
          transition: 'transform 160ms ease, box-shadow 160ms ease',
        }}
      >
        PREVIEW
      </div>
    ),
    center: null,
    right: rightSlot,
  }), [PREVIEW_SIZE, hidePreviewHover, isPreviewHoverActive, rightSlot, showPreviewHover]);

  const middleTopRow = useMemo(() => ({
    left: (
      <Typography.Link
        onClick={openScaleModal}
        style={{
          fontSize: 12,
          lineHeight: 1.2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          height: ACTION_SIZE,
        }}
      >
        <span>{pixelWidth}px</span>
        <span>{coveragePercent}%</span>
      </Typography.Link>
    ),
    center: undefined,
    right: middleTopSlot,
  }), [ACTION_SIZE, coveragePercent, middleTopSlot, openScaleModal, pixelWidth]);

  const middleBottomRow = useMemo(() => {
    const showRight = isRunHoverVisible || isRunButtonsHovering;
    const showLeft = !showRight && isPreviewHoverVisible;
    const showCenter = !showLeft && !showRight;

    return {
      left: showLeft ? (
        <Typography.Link onClick={() => console.log('Set workflow boundary')}>
          点击设为选中区域
        </Typography.Link>
      ) : undefined,
      center: showCenter
        ? (persistentStatus ?? <div className="workflow-controls-middle-bottom-placeholder" />)
        : undefined,
      right: showRight ? runMultiplierButtons : undefined,
    };
  }, [
    isPreviewHoverVisible,
    isRunButtonsHovering,
    isRunHoverVisible,
    persistentStatus,
    runMultiplierButtons,
  ]);

  useEffect(() => () => {
    clearPreviewHoverTimeout();
    clearRunHoverTimeout();
  }, [clearPreviewHoverTimeout, clearRunHoverTimeout]);

  return (
    <div style={{ width: '100%' }}>
      <Segmented
        style={{ marginBottom: 16 }}
        options={[
          { label: '文本', value: 'text' },
          { label: '上传中', value: 'uploading' },
          { label: '进度', value: 'progress' },
          { label: '报错', value: 'error' },
        ]}
        value={statusKey}
        onChange={(value) => setStatusKey(value as StatusKey)}
      />
      <WorkflowControlsPanel
        headerRow={headerRow}
        bodyRow={bodyRow}
        middleTopRow={middleTopRow}
        middleBottomRow={middleBottomRow}
      />
      <Modal
        title="调整工作区设置"
        open={isScaleModalOpen}
        onOk={handleScaleSubmit}
        onCancel={closeScaleModal}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="pixelWidth"
            label="画布宽度 (px)"
            rules={[
              { required: true, message: '请输入画布宽度' },
              { type: 'number', min: 1, message: '宽度需大于 0' },
            ]}
          >
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="coveragePercent"
            label="画布覆盖率 (%)"
            rules={[
              { required: true, message: '请输入覆盖率' },
              { type: 'number', min: 1, max: 100, message: '覆盖率需在 1-100 之间' },
            ]}
          >
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export const InteractivePreview: Story = {
  render: () => <div style={{ width: 320 }}><DemoPanel /></div>,
};
