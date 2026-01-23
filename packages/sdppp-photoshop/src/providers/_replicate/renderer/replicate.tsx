import { sdpppSDK, useTranslation } from '@sdppp/common';
import { WidgetableNode } from '@sdppp/common/schemas/schemas';
import type { WorkflowStatusDescriptor } from '@sdppp/ui-library';
import { loadRemoteConfig } from '@sdppp/vite-remote-config-loader';
import { WidgetableProvider, WorkflowEditApiFormat } from '@sdppp/widgetable-ui';
import { Alert, Button, Flex, Input, Tooltip } from 'antd';
import Link from 'antd/es/typography/Link';
import { CircleStop, HelpCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SimpleWorkflowControlPanel } from '../../_comfy_frontend/renderer/components/workflow-detail/components/SimpleWorkflowControlPanel';
import { ModelSelector } from '../../base/components/ModelSelector';
import '../../base/styles/workflow-controls.less';
import { UploadPassProvider } from '../../base/upload-pass-context';
import { useTaskExecutor } from '../../base/useTaskExecutor';
import { WidgetablePhotoshopProvider, createImageMaskWidgetRegistry } from '../../base/widgetable-photoshop';
import './replicate.less';
import { changeSelectedModel, createTask, replicateStore } from './replicate.store';

const { Password } = Input;

export default function ReplicateRenderer({ showingPreview }: { showingPreview: boolean }) {
    const { t } = useTranslation()
    const { apiKey, setApiKey } = replicateStore();

    return (
        <Flex className="replicate-renderer" vertical gap={8}>
            {!showingPreview ? <Flex gap={8}>
                <Password
                    placeholder={t('replicate.apikey_placeholder')}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                />
            </Flex> : null}
            {
                !apiKey && <Link onClick={() => sdpppSDK.plugins.photoshop.openExternalLink({ url: "https://replicate.com/account/api-tokens" })}>{t('replicate.get_apikey')}</Link>
            }


            <Flex gap={8} vertical>
                {apiKey && <ReplicateRendererModels />}
            </Flex>
        </Flex>
    );
}

function ReplicateRendererModels() {
    const { t, language } = useTranslation();
    const translate = t as unknown as (key: string, options?: Record<string, unknown>) => string;
    const { selectedModel, availableModels, removeModel, addModel } = replicateStore();
    const client = replicateStore((state) => state.client);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string>('');

    // Load initial model on mount
    useEffect(() => {
        if (client && selectedModel && !replicateStore.getState().currentNodes.length) {
            setLoadError('');
            setLoading(true);
            changeSelectedModel(selectedModel).catch((error: any) => {
                setLoadError(error.message || error.toString());
            }).finally(() => {
                setLoading(false);
            });
        }
    }, [client, selectedModel]);

    if (!client) {
        return null;
    }

    const handleModelChange = async (value: string) => {
        if (value === selectedModel) {
            return;
        }
        if (client) {
            setLoadError('');
            setLoading(true);
            try {
                await changeSelectedModel(value);
                addModel(value);
                replicateStore.setState({
                    selectedModel: value
                });
            } catch (error: any) {
                setLoadError(error.message || error.toString());
            } finally {
                setLoading(false);
            }
        }
    };

    const modelOptions = availableModels.map((model) => ({
        label: model,
        value: model,
        deletable: model !== selectedModel
    }));

    return (
        <UploadPassProvider
            uploader={async (uploadInput, signal) => {
                const inferFormat = (mime?: string) => {
                    if (!mime) return 'png';
                    const subtype = mime.split('/')[1] || '';
                    if (subtype === 'jpeg') return 'jpg';
                    if (subtype.includes('png')) return 'png';
                    if (subtype.includes('jpg')) return 'jpg';
                    if (subtype.includes('webp')) return 'webp';
                    return 'png';
                };

                const format = inferFormat(uploadInput.mimeType) as 'png' | 'jpg' | 'jpeg' | 'webp';

                return await client.uploadImage('resource', uploadInput.resource, format, signal);
            }}
        >
            <WidgetablePhotoshopProvider>
                <WidgetableProvider widgetRegistry={createImageMaskWidgetRegistry()}>
                    <ReplicateRendererForm
                        selectedModel={selectedModel}
                        loading={loading}
                        loadError={loadError}
                        modelOptions={modelOptions}
                        onModelChange={handleModelChange}
                        onModelRemove={removeModel}
                        language={language}
                    />
                    {loading && <Alert message={translate('replicate.loading', { defaultMessage: 'Loading...' })} type="info" showIcon />}
                    {loadError && <Alert message={loadError} type="error" showIcon />}
                </WidgetableProvider>
            </WidgetablePhotoshopProvider>
        </UploadPassProvider>
    )
}

interface ReplicateRendererFormProps {
    selectedModel: string | undefined;
    loading: boolean;
    loadError: string;
    modelOptions: { value: string; label: string }[];
    onModelChange: (value: string) => Promise<void> | void;
    onModelRemove: (value: string) => void;
    language: string;
}

function ReplicateRendererForm({
    selectedModel,
    loading,
    loadError,
    modelOptions,
    onModelChange,
    onModelRemove,
    language,
}: ReplicateRendererFormProps) {
    const { t } = useTranslation()
    const currentNodes = replicateStore((state) => state.currentNodes);
    const currentValues = replicateStore((state) => state.currentValues);
    const setCurrentValues = replicateStore((state) => state.setCurrentValues);
    const runningTasks = replicateStore((state) => state.runningTasks);

    const { runError, progressMessage, handleRun, handleCancel, isRunning, canCancel } = useTaskExecutor({
        selectedModel,
        currentValues,
        getCurrentValues: () => replicateStore.getState().currentValues,
        createTask,
        runningTasks,
        beforeCreateTaskHook: (values) => {
            // Process image fields to extract URLs
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
    const translate = t as unknown as (key: string, options?: Record<string, unknown>) => string;

    return (
        <>
            <Flex gap={4} align="center" style={{ marginBottom: 8, width: '100%' }}>
                <Tooltip title={translate('replicate.help_tooltip', { defaultMessage: 'How to use?' })} placement="left">
                    <Button
                        type="text"
                        size="small"
                        icon={<HelpCircle size={16} />}
                        style={{ color: 'var(--sdppp-host-text-color-secondary)' }}
                        onClick={async () => {
                            const banners = loadRemoteConfig('banners');
                            const replicateURL = banners.find((banner: any) => banner.type === 'replicate_tutorial' && banner.locale == language)?.link;
                            if (replicateURL) {
                                sdpppSDK.plugins.photoshop.openExternalLink({ url: replicateURL });
                            }
                        }}
                    />
                </Tooltip>
                <ModelSelector
                    value={selectedModel}
                    placeholder={translate('replicate.model_placeholder')}
                    loading={loading}
                    loadError={loadError}
                    options={modelOptions}
                    onChange={onModelChange}
                    onDelete={onModelRemove}
                />
            </Flex>
            <SimpleWorkflowControlPanel
                headerCenter={undefined}
                runTooltip={translate('replicate.execute', { defaultMessage: 'Execute' })}
                runDisabled={isRunning || loading || !selectedModel}
                onRun={handleRun}
                cancelTooltip={translate('replicate.stop', { defaultMessage: 'Stop' })}
                canCancel={canCancel}
                onCancel={handleCancel}
                middleTopRight={(
                    <Tooltip title={translate('replicate.stop', { defaultMessage: 'Stop' })}>
                        <Button
                            className="workflow-action-button"
                            danger
                            icon={<CircleStop size={18} />}
                            onClick={handleCancel}
                            disabled={!canCancel}
                        />
                    </Tooltip>
                )}
                status={((): WorkflowStatusDescriptor => {
                    if (runError) return { type: 'error', message: runError };
                    if (progressMessage) return { type: 'text', tone: 'secondary', message: progressMessage };
                    if (isRunning) return { type: 'uploading', message: translate('replicate.running', { defaultMessage: 'Running...' }) };
                    return { type: 'empty' };
                })()}
            />
            <WorkflowEditApiFormat
                modelName={selectedModel}
                nodes={currentNodes}
                values={currentValues}
                errors={{}}
                onWidgetChange={(_widgetIndex: number, value: any, fieldInfo: WidgetableNode) => {
                    const live = replicateStore.getState().currentValues;
                    setCurrentValues({ ...live, [fieldInfo.id]: value });
                }}
            />
        </>
    )
}
