import { sdpppSDK, useTranslation } from '@sdppp/common';
import { WidgetableNode } from '@sdppp/common/schemas/schemas';
import type { WorkflowStatusDescriptor } from '@sdppp/ui-library';
import { loadRemoteConfig } from '@sdppp/vite-remote-config-loader';
import { WidgetableProvider, WorkflowEditApiFormat } from '@sdppp/widgetable-ui';
import { Alert, Button, Flex, Input, Tooltip } from 'antd';
import Link from 'antd/es/typography/Link';
import { CircleStop, HelpCircle } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { SimpleWorkflowControlPanel } from '../../_comfy_frontend/renderer/components/workflow-detail/components/SimpleWorkflowControlPanel';
import { ModelSelector } from '../../base/components/ModelSelector';
import '../../base/styles/workflow-controls.less';
import { UploadPassProvider } from '../../base/upload-pass-context';
import { useTaskExecutor } from '../../base/useTaskExecutor';
import { WidgetablePhotoshopProvider, createImageMaskWidgetRegistry } from '../../base/widgetable-photoshop';
import './runninghub.less';
import { changeSelectedModel, createTask, runninghubStore } from './runninghub.store';

const log = sdpppSDK.logger.extend('runninghub')

const { Password } = Input;

export default function RunningHubRenderer({ showingPreview }: { showingPreview: boolean }) {
    const { t, language } = useTranslation()
    const { apiKey, setApiKey } = runninghubStore();
    const [error, setError] = useState<string>('');

    return (
        <Flex className="runninghub-renderer" vertical gap={8}>
            {!showingPreview ? <Flex gap={8}>
                <Password
                    placeholder={t('runninghub.apikey_placeholder')}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                />
            </Flex> : null}
            {
                !apiKey && <Link underline onClick={async () => {
                    const banners = loadRemoteConfig('banners');
                    const runninghubURL = banners.find((banner: any) => banner.type === 'runninghub' && banner.locale == language)?.link;
                    sdpppSDK.plugins.photoshop.openExternalLink({ url: runninghubURL })
                }}>{t('runninghub.get_apikey')}</Link>
            }

            {error && (
                <Alert
                    message={t('common.error')}
                    description={error}
                    type="error"
                    showIcon
                    style={{ marginBottom: 16 }}
                />
            )}

            {apiKey && <AccountStatus />}

            <Flex gap={8} vertical>
                {apiKey && <RunningHubRendererModels />}
            </Flex>
        </Flex>
    );
}

function RunningHubRendererModels() {
    const { webappId, setWebappId, webappHistory, removeWebappHistory, appName } = runninghubStore();
    const client = runninghubStore((state) => state.client);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string>('');

    // Auto-load selected webapp on component mount
    useEffect(() => {
        if (webappId && client && !loading && !runninghubStore.getState().currentNodes.length) {
            log('Auto-loading webapp on mount:', webappId);
            setLoading(true);
            changeSelectedModel(webappId)
                .catch((error: any) => {
                    setLoadError(error.message || error.toString());
                })
                .finally(() => {
                    setLoading(false);
                });
        }
    }, [client, webappId]); // Depend on both client and webappId

    if (!client) {
        return null;
    }

    const handleWebappIdChange = async (value: string) => {
        log('handleWebappIdChange called with value:', value);
        log('current webappId:', webappId);
        
        // 如果输入的是appName，需要找到对应的webappId
        let actualWebappId = value;
        const historyItem = webappHistory.find(item => item.appName === value);
        if (historyItem) {
            actualWebappId = historyItem.webappId;
            log('found in history, actualWebappId:', actualWebappId);
        }

        log('final actualWebappId:', actualWebappId);
        
        if (!actualWebappId.trim()) {
            log('skipping - empty webappId');
            return;
        }
        
        setLoadError('');
        setLoading(true);
        try {
            await changeSelectedModel(actualWebappId);
            setWebappId(actualWebappId);
        } catch (error: any) {
            setLoadError(error.message || error.toString());
        } finally {
            setLoading(false);
        }
    };

    // 准备Select的选项
    const selectOptions = webappHistory.map(item => ({
        value: item.webappId,
        label: item.webappId ? (
            <Tooltip title={item.webappId} placement="right">
                <span 
                    style={{ 
                        fontWeight: 'bold', 
                        color: 'var(--sdppp-host-text-color)',
                        width: '100%',
                        display: 'block'
                    }}
                >
                    {item.appName}
                </span>
            </Tooltip>
        ) : (
            <span 
                style={{ 
                    fontWeight: 'bold', 
                    color: 'var(--sdppp-host-text-color)',
                    width: '100%',
                    display: 'block'
                }}
            >
                {item.appName}
            </span>
        ),
        // 用于搜索的纯文本
        searchText: `${item.appName} ${item.webappId}`,
        // 用于显示的文本（选中后显示在输入框中）
        displayText: item.appName,
        deletable: true
    }));

    const { t, language } = useTranslation();

    return (
        <UploadPassProvider
            uploader={async (uploadInput, signal) => {
                if (uploadInput.type !== 'resource') throw new Error('Unsupported upload type: ' + uploadInput.type);
                return await client.uploadImage(uploadInput.type, uploadInput.resourceId as string, 'png', signal);
            }}
        >
        <WidgetablePhotoshopProvider>
            <WidgetableProvider widgetRegistry={createImageMaskWidgetRegistry()}>
                <RunningHubRendererForm
                    loading={loading}
                    loadError={loadError}
                    selectOptions={selectOptions}
                    onSelectChange={handleWebappIdChange}
                    onSelectRemove={removeWebappHistory}
                    language={language}
                />
                {loadError && <Alert message={loadError} type="error" showIcon />}
            </WidgetableProvider>
        </WidgetablePhotoshopProvider>
        </UploadPassProvider>
    )
}

interface RunningHubRendererFormProps {
    loading: boolean;
    loadError: string;
    selectOptions: { value: string; label: ReactNode; searchText: string; displayText: string; deletable: boolean }[];
    onSelectChange: (value: string) => Promise<void> | void;
    onSelectRemove: (value: string) => void;
    language: string;
}

function RunningHubRendererForm({
    loading,
    loadError,
    selectOptions,
    onSelectChange,
    onSelectRemove,
    language,
}: RunningHubRendererFormProps) {
    const { t } = useTranslation()
    const translate = t as unknown as (key: string, options?: Record<string, unknown>) => string;
    const currentNodes = runninghubStore((state) => state.currentNodes);
    const currentValues = runninghubStore((state) => state.currentValues);
    const setCurrentValues = runninghubStore((state) => state.setCurrentValues);
    const webappId = runninghubStore((state) => state.webappId);
    const runningTasks = runninghubStore((state) => state.runningTasks);
    const appName = runninghubStore((state) => state.appName);

    const { runError, progressMessage, handleRun, handleCancel, isRunning, canCancel } = useTaskExecutor({
        selectedModel: webappId,
        currentValues,
        getCurrentValues: () => runninghubStore.getState().currentValues,
        createTask,
        runningTasks,
        beforeCreateTaskHook: (values) => {
            // 处理图片字段，从对象中提取URL
            const processedValues = { ...values };

            currentNodes.forEach((node) => {
                if (node.widgets[0].outputType === 'images') {
                    const fieldValue = processedValues[node.id];
                    if (fieldValue) {
                        if (Array.isArray(fieldValue)) {
                            processedValues[node.id] = fieldValue.map((item: any) =>
                                (typeof item === 'object' && item.url) ? item.url : item
                            );
                        } else if (typeof fieldValue === 'object' && fieldValue.url) {
                            processedValues[node.id] = fieldValue.url;
                        }
                    }
                }
            });

            return processedValues;
        }
    });

    return (
        <>
            <Flex gap={4} align="center" style={{ marginBottom: 8, width: '100%' }}>
                <Tooltip title={translate('runninghub.help_tooltip', { defaultMessage: 'How to use?' })} placement="left">
                    <Button
                        type="text"
                        size="small"
                        icon={<HelpCircle size={16} />}
                        style={{ color: 'var(--sdppp-host-text-color-secondary)' }}
                        onClick={async () => {
                            const banners = loadRemoteConfig('banners');
                            const runninghubURL = banners.find((banner: any) => banner.type === 'runninghub_tutorial' && banner.locale == language)?.link;
                            if (runninghubURL) {
                                sdpppSDK.plugins.photoshop.openExternalLink({ url: runninghubURL });
                            }
                        }}
                    />
                </Tooltip>
                <ModelSelector
                    value={appName || webappId}
                    placeholder={translate('runninghub.webapp_id_placeholder')}
                    loading={loading}
                    loadError={loadError}
                    options={selectOptions}
                    onChange={onSelectChange}
                    onDelete={onSelectRemove}
                />
            </Flex>
            <SimpleWorkflowControlPanel
                headerRight={undefined}
                runTooltip={translate('runninghub.execute', { defaultMessage: 'Execute' })}
                runDisabled={isRunning || loading || !webappId}
                onRun={handleRun}
                cancelTooltip={translate('runninghub.stop_all', { defaultMessage: 'Stop' })}
                canCancel={canCancel}
                onCancel={handleCancel}
                middleTopRight={(
                    <Tooltip title={translate('runninghub.stop_all', { defaultMessage: 'Stop' })}>
                        <Button
                            className="workflow-action-button"
                            icon={<CircleStop size={18} />}
                            danger
                            onClick={handleCancel}
                            disabled={!canCancel}
                        />
                    </Tooltip>
                )}
                status={((): WorkflowStatusDescriptor => {
                    if (runError) return { type: 'error', message: runError };
                    if (progressMessage) return { type: 'text', tone: 'secondary', message: progressMessage };
                    if (isRunning) return { type: 'uploading', message: translate('runninghub.running', { defaultMessage: 'Running...' }) };
                    return { type: 'empty' };
                })()}
            />
            <WorkflowEditApiFormat
                modelName={webappId}
                nodes={currentNodes}
                values={currentValues}
                errors={{}}
                onWidgetChange={(_widgetIndex: number, value: any, fieldInfo: WidgetableNode) => {
                    const live = runninghubStore.getState().currentValues;
                    setCurrentValues({ ...live, [fieldInfo.id]: value });
                }}
            />
        </>
    )
}

function AccountStatus() {
    const { t } = useTranslation()
    const { accountStatus } = runninghubStore();

    if (!accountStatus) {
        return null;
    }

    return (
        <Flex justify='space-between' gap={16} style={{ color: 'var(--sdppp-host-text-color-secondary)', fontSize: '12px' }}>
            <div>
                <span>{t('runninghub.rh_coins')}</span>
                <span>{accountStatus.remainCoins}</span>
            </div>
            <div>
                <span>{t('runninghub.current_tasks')}</span>
                <span>{accountStatus.currentTaskCounts}</span>
            </div>
        </Flex>
    );
}
