import './customapi.less';
import { Input, Alert, Flex, Button, Select } from 'antd';
import { useState, useEffect } from 'react';
import { customapiStore, changeSelectedModel, createTask } from './customapi.store';
import { WorkflowEditApiFormat } from '@sdppp/widgetable-ui';
import Link from 'antd/es/typography/Link';
import { sdpppSDK } from '@sdppp/common';
import { WidgetableNode } from '@sdppp/common/schemas/schemas';
import { WidgetableProvider } from '@sdppp/widgetable-ui';
import { useTaskExecutor } from '../../base/useTaskExecutor';
import { useTranslation } from '@sdppp/common';
// removed help icon
import { createBaseWidgetRegistry } from '../../base/widgetable-integration/widgetable-widgets';
import { WorkBoundary } from '../../base/components';

const log = sdpppSDK.logger.extend('customapi')

const { Password } = Input;

export default function CustomAPIRenderer({ showingPreview }: { showingPreview: boolean }) {
    const { t } = useTranslation()
    const { apiKey, setApiKey, baseURL, setBaseURL, format, setFormat, selectedModel, setSelectedModel } = customapiStore();
    const [error, setError] = useState<string>('');

    return (
        <Flex className="customapi-renderer" vertical gap={8}>
            {!showingPreview ? <Flex gap={8} vertical>
                {/* First line: Base URL */}
                <Input
                    placeholder={t('google.baseurl_placeholder', 'Base URL')}
                    value={baseURL}
                    onChange={(e) => setBaseURL(e.target.value)}
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
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
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
                {apiKey && <CustomAPIRendererModels />}
            </Flex>
        </Flex>
    );
}

function CustomAPIRendererModels() {
    const client = customapiStore((state) => state.client);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string>('');

    // Auto-load model on component mount or when selection changes
    useEffect(() => {
        const { selectedModel } = customapiStore.getState();
        if (client && !loading && !customapiStore.getState().currentNodes.length && selectedModel) {
            log('Auto-loading model');
            setLoading(true);
            changeSelectedModel(selectedModel)
                .catch((error: any) => {
                    setLoadError(error.message || error.toString());
                })
                .finally(() => {
                    setLoading(false);
                });
        }
    }, [client]);

    if (!client) {
        return null;
    }

    const { t } = useTranslation();

    return (
        <WidgetableProvider
            uploader={async (uploadInput, signal) => {
                // return await client.uploadImage(uploadInput.type, uploadInput.tokenOrBuffer, 'png', signal);
                return uploadInput.tokenOrBuffer;
            }}
            widgetRegistry={createBaseWidgetRegistry()}
        >
            {/* No help icon or model title header for Custom API */}
            {!loading && !loadError && <CustomAPIRendererForm />}
            {loading && <Alert message={t('google.loading', 'Loading...')} type="info" showIcon />}
            {loadError && <Alert message={loadError} type="error" showIcon />}
        </WidgetableProvider>
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

    const { runError, progressMessage, handleRun, handleCancel, isRunning, canCancel } = useTaskExecutor({
        selectedModel: model,
        currentValues,
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
            <WorkflowEditApiFormat
                modelName={model}
                nodes={currentNodes}
                values={currentValues}
                errors={{}}
                onWidgetChange={(_widgetIndex: number, value: any, fieldInfo: WidgetableNode) => {
                    currentValues[fieldInfo.id] = value;
                    setCurrentValues(currentValues);
                }}
            />
        </>
    )
}
