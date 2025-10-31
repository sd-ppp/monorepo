import { QuestionCircleOutlined } from '@ant-design/icons';
import { sdpppSDK, useTranslation } from '@sdppp/common';
import { WidgetableNode } from '@sdppp/common/schemas/schemas';
import { loadRemoteConfig } from '@sdppp/vite-remote-config-loader';
import { WidgetableProvider, WorkflowEditApiFormat } from '@sdppp/widgetable-ui';
import { UploadPassProvider } from '../../base/upload-pass-context';
import { Alert, Button, Flex, Input, Tooltip } from 'antd';
import Link from 'antd/es/typography/Link';
import { useEffect, useState } from 'react';
import { WorkBoundary } from '../../base/components';
import { ModelSelector } from '../../base/components/ModelSelector';
import { useTaskExecutor } from '../../base/useTaskExecutor';
import { createImageMaskWidgetRegistry } from '../../base/widgetable-image-mask/widgetable-widgets';
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
                const source = uploadInput.resource as any;
                let payload: ArrayBuffer;
                if (source && typeof source === 'object' && 'data' in source) {
                    const data = source.data;
                    if (data instanceof ArrayBuffer) {
                        payload = data;
                    } else if (ArrayBuffer.isView(data)) {
                        payload = (data as ArrayBufferView).buffer;
                    } else {
                        payload = data as ArrayBuffer;
                    }
                } else if (uploadInput.resource instanceof ArrayBuffer) {
                    payload = uploadInput.resource;
                } else if (ArrayBuffer.isView(uploadInput.resource)) {
                    payload = (uploadInput.resource as ArrayBufferView).buffer;
                } else {
                    payload = uploadInput.resource as ArrayBuffer;
                }

                return await client.uploadImage('buffer', payload, format, signal);
            }}
        >
        <WidgetableProvider widgetRegistry={createImageMaskWidgetRegistry()}>
            <Flex gap={4} align="center">
                <Tooltip title={t('replicate.help_tooltip', { defaultMessage: 'How to use?' })} placement="left">
                    <Button
                        type="text"
                        size="small"
                        icon={<QuestionCircleOutlined />}
                        onClick={async () => {
                            const banners = loadRemoteConfig('banners');
                            const replicateURL = banners.find((banner: any) => banner.type === 'replicate_tutorial' && banner.locale == language)?.link;
                            sdpppSDK.plugins.photoshop.openExternalLink({ url: replicateURL })
                        }}
                        style={{ color: 'var(--sdppp-host-text-color-secondary)' }}
                    />
                </Tooltip>
                <ModelSelector
                    value={selectedModel}
                    placeholder={t('replicate.model_placeholder')}
                    loading={loading}
                    loadError={loadError}
                    options={modelOptions}
                    onChange={handleModelChange}
                    onDelete={removeModel}
                />
            </Flex>
            {selectedModel && !loading && !loadError && <ReplicateRendererForm />}
        </WidgetableProvider>
        </UploadPassProvider>
    )
}

function ReplicateRendererForm() {
    const { t } = useTranslation()
    const currentNodes = replicateStore((state) => state.currentNodes);
    const currentValues = replicateStore((state) => state.currentValues);
    const setCurrentValues = replicateStore((state) => state.setCurrentValues);
    const selectedModel = replicateStore((state) => state.selectedModel);
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
    return (
        <>
            <WorkBoundary />
            <Button type="primary" onClick={handleRun}>{t('replicate.execute')}</Button>
            {progressMessage && (
                <Alert 
                    message={progressMessage} 
                    type="info" 
                    showIcon
                    action={canCancel ? (
                        <Button size="small" type="text" onClick={handleCancel}>
                            {t('common.cancel')}
                        </Button>
                    ) : undefined}
                />
            )}
            {runError && <Alert message={runError} type="error" showIcon />}
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
