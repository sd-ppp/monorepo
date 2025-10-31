import { sdpppSDK, useTranslation } from '@sdppp/common';
import { WidgetableNode } from '@sdppp/common/schemas/schemas';
import { WidgetableProvider, WorkflowEditApiFormat } from '@sdppp/widgetable-ui';
import { UploadPassProvider } from '../../base/upload-pass-context';
import { Alert, Button, Flex, Input, Select } from 'antd';
import { useEffect, useMemo, useState, useRef } from 'react';
import { useTaskExecutor } from '../../base/useTaskExecutor';
import './customapi.less';
import { changeSelectedModel, createTask, customapiStore } from './customapi.store';
// removed help icon
import { WorkBoundary } from '../../base/components';
import { createImageMaskWidgetRegistry } from '../../base/widgetable-image-mask/widgetable-widgets';

const log = sdpppSDK.logger.extend('customapi')

const { Password } = Input;

export default function CustomAPIRenderer({ showingPreview }: { showingPreview: boolean }) {
    const { t } = useTranslation()
    const { apiKey, setApiKey, baseURL, setBaseURL, format, setFormat, selectedModel, setSelectedModel } = customapiStore();
    // Only render models section when client is ready, avoiding transient states
    const hasClient = customapiStore((state) => !!state.client);
    const [error, setError] = useState<string>('');

    return (
        <Flex className="customapi-renderer" vertical gap={8}>
            {!showingPreview ? <Flex gap={8} vertical>
                {/* First line: Base URL */}
                <Input
                    placeholder={t('google.baseurl_placeholder', 'Base URL')}
                    value={baseURL ?? ''}
                    onChange={(e) => setBaseURL((e?.target?.value ?? '').toString())}
                />
                {/* Second line: Format + API Key */}
                <Flex gap={8}>
                    <Select
                        value={format}
                        onChange={(v) => setFormat(v as any)}
                        options={[
                            { label: 'Google format', value: 'google' },
                            { label: 'OpenAI format', value: 'openai' },
                        ]}
                        style={{ minWidth: 160 }}
                    />
                    <Password
                        placeholder={format === 'google' ? t('google.apikey_placeholder', 'Enter Google API Key') : 'Enter OpenAI API Key'}
                        value={apiKey ?? ''}
                        onChange={(e) => setApiKey((e?.target?.value ?? '').toString())}
                    />
                </Flex>
                {/* Third line: Model name */}
                <Input
                    placeholder={format === 'google' ? 'gemini-2.5-flash-image-preview' : 'gpt-image-1'}
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                />
            </Flex> : null}
            
            {error && (
                <Alert
                    message={t('common.error')}
                    description={error}
                    type="error"
                    showIcon
                    style={{ marginBottom: 16 }}
                />
            )}

            <Flex gap={8} vertical>
                {hasClient && <CustomAPIRendererModels />}
            </Flex>
        </Flex>
    );
}

function CustomAPIRendererModels() {
    const client = customapiStore((state) => state.client);
    const selectedModel = customapiStore((state) => state.selectedModel);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string>('');
    const didInitLoadRef = useRef(false);

    // Auto-load model only once on initial mount after client is ready
    useEffect(() => {
        if (client && selectedModel && !didInitLoadRef.current) {
            didInitLoadRef.current = true;
            log('Auto-loading model (initial mount)', { selectedModel });
            setLoading(true);
            changeSelectedModel(selectedModel)
                .catch((error: any) => {
                    setLoadError(error.message || error.toString());
                })
                .finally(() => {
                    setLoading(false);
                });
        }
    }, [client, selectedModel]);

    if (!client) {
        return null;
    }

    const { t } = useTranslation();

    return (
        <UploadPassProvider
            uploader={async (uploadInput, signal) => {
                if (uploadInput.type === 'buffer') {
                    const source = uploadInput.resource as any;
                    const arrayBuffer = source?.data ?? uploadInput.resource;
                    const bytes = new Uint8Array(arrayBuffer);
                    const binary = Array.from(bytes)
                        .map((b) => String.fromCharCode(b))
                        .join('');
                    const base64 = typeof btoa === 'function'
                        ? btoa(binary)
                        : Buffer.from(arrayBuffer).toString('base64');
                    const mime = uploadInput.mimeType ?? 'image/png';
                    return `data:${mime};base64,${base64}`;
                }
                return uploadInput.resource as string;
            }}
        >
        <WidgetableProvider widgetRegistry={createImageMaskWidgetRegistry()}>
            {/* No help icon or model title header for Custom API */}
            {!loading && !loadError && <CustomAPIRendererForm />}
            {loading && <Alert message={t('google.loading')} type="info" showIcon />}
            {loadError && <Alert message={loadError} type="error" showIcon />}
        </WidgetableProvider>
        </UploadPassProvider>
    )
}

function CustomAPIRendererForm() {
    const { t } = useTranslation()
    const { format, selectedModel } = customapiStore();
    const currentNodes = customapiStore((state) => state.currentNodes);
    const currentValues = customapiStore((state) => state.currentValues);
    const setCurrentValues = customapiStore((state) => state.setCurrentValues);
    const runningTasks = customapiStore((state) => state.runningTasks);
    const model = selectedModel;

    // Adjust maxCount for OpenAI gpt-image-1 to 1 (move hook to top-level to follow Rules of Hooks)
    const adjustedNodes = useMemo(() => {
        if (format === 'openai' && (model || '').toLowerCase() === 'gpt-image-1') {
            return currentNodes.map((node) => ({
                ...node,
                widgets: node.widgets.map((w) => (
                    w.outputType === 'images'
                        ? { ...w, options: { ...(w.options || {}), maxCount: 1 } }
                        : w
                ))
            }));
        }
        return currentNodes;
    }, [format, model, currentNodes]);

    const { runError, progressMessage, handleRun, handleCancel, isRunning, canCancel } = useTaskExecutor({
        selectedModel: model,
        currentValues,
        getCurrentValues: () => customapiStore.getState().currentValues,
        createTask,
        runningTasks,
        beforeCreateTaskHook: (values) => {
            // Process image fields, extract URL from objects
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
            <Button type="primary" onClick={handleRun} disabled={isRunning}>
                {isRunning ? t('google.generating', 'Generating...') : t('google.generate', 'Generate')}
            </Button>
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
            {/* Adjust maxCount for OpenAI gpt-image-1 to 1 */}
            <WorkflowEditApiFormat
                modelName={model}
                nodes={adjustedNodes}
                values={currentValues}
                errors={{}}
                onWidgetChange={(_widgetIndex: number, value: any, fieldInfo: WidgetableNode) => {
                const live = customapiStore.getState().currentValues;
                setCurrentValues({ ...live, [fieldInfo.id]: value });
                }}
            />
        </>
    )
}
