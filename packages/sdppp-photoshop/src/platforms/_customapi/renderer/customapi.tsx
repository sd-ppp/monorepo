import { useTranslation } from '@sdppp/common';
import { FormProvider, createSchemaField } from '@formily/react';
import {
    FormItem as FormilyFormItem,
    type FormItemProps as FormilyFormItemProps,
    Input as FormilyInput,
    NumberPicker,
    Select as FormilySelect,
    Switch,
    ArrayItems,
    FormLayout,
} from '@formily/antd-v5';
import type { ISchema } from '@formily/json-schema';
import {
    SdpppWidgetDeferredUploadSelector,
    SdpppWidgetUploadSelectorRouter,
} from '@sdppp/formily-widgets';
import { Alert, Flex, Input, Select, Spin } from 'antd';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { UploadPassInput } from '../../base/upload-pass-context';
import { UploadPassProvider } from '../../base/upload-pass-context';
import { useTaskExecutionStore } from '../../base/taskExecutionStore';
import { useTaskExecutor } from '../../base/useTaskExecutor';
import './customapi.less';
import { createTask, customapiStore } from './customapi.store';
import type { WorkflowStatusDescriptor } from '@sdppp/ui-library';
import { SimpleWorkflowControlPanel } from '../../_comfy_frontend/renderer/components/workflow-detail/components/SimpleWorkflowControlPanel';
import '../../base/styles/workflow-controls.less';
import { WrappedSdpppWidgetProvider } from '../../base/widgetable-photoshop';
import { customapiFormStore } from './customapi.formStore';
import { customapiSchemaStore } from './customapi.schemaStore';
import { useCustomApiSchemaForm } from './useCustomApiSchemaForm';

const { Password } = Input;

const FormItem = (props: FormilyFormItemProps & { hidden?: boolean }) => {
    const { description: _description, extra: _extra, hidden, ...rest } = props;
    if (hidden) {
        return (
            <div
                style={{
                    position: 'absolute',
                    left: '-9999px',
                    width: '10px',
                    height: '10px',
                    opacity: 0.01,
                    pointerEvents: 'none',
                }}
            >
                <FormilyFormItem {...rest} />
            </div>
        );
    }
    return <FormilyFormItem {...rest} />;
};

const SchemaField = createSchemaField({
    components: {
        FormItem,
        Input: FormilyInput,
        NumberPicker,
        InputNumber: NumberPicker,
        Select: FormilySelect,
        Switch,
        ArrayItems,
        'Input.TextArea': FormilyInput.TextArea,
        FormLayout,
        Upload: SdpppWidgetUploadSelectorRouter,
        UploadSelector: SdpppWidgetUploadSelectorRouter,
        DeferredUploadSelector: SdpppWidgetDeferredUploadSelector,
    },
});

const EMPTY_SCHEMA: ISchema = { type: 'object', properties: {} };

export default function CustomAPIRenderer({ showingPreview }: { showingPreview: boolean }) {
    const uploadResource = useCallback(async (resourceId: string) => {
        return resourceId;
    }, []);

    const passthroughUpload = useCallback(
        async (_uploadInput: UploadPassInput, _signal?: AbortSignal) => {
            throw new Error('UploadPassProvider is not required for CustomAPI; use SdpppWidgetUploadSelector instead.');
        },
        [],
    );

    return (
        <UploadPassProvider uploader={passthroughUpload}>
            <WrappedSdpppWidgetProvider uploadResource={uploadResource}>
                <CustomApiContent showingPreview={showingPreview} />
            </WrappedSdpppWidgetProvider>
        </UploadPassProvider>
    );
}

function CustomApiContent({ showingPreview }: { showingPreview: boolean }) {
    const { t } = useTranslation();
    const { apiKey, setApiKey, baseURL, setBaseURL, format, setFormat, selectedModel, setSelectedModel } = customapiStore();
    const client = customapiStore(state => state.client);
    const hasClient = Boolean(client);
    const { loadSchema } = useCustomApiSchemaForm();
    const lastSchemaKeyRef = useRef<string>('');

    useEffect(() => {
        const model = selectedModel.trim();
        if (!client || !model) return;
        const schemaKey = `${format}:${model}`;
        if (lastSchemaKeyRef.current === schemaKey) return;
        lastSchemaKeyRef.current = schemaKey;
        void loadSchema(model);
    }, [client, format, loadSchema, selectedModel]);

    return (
        <Flex className="customapi-renderer" vertical gap={8}>
            {!showingPreview ? (
                <Flex gap={8} vertical>
                    <Flex gap={8}>
                        <Select
                            value={format}
                            onChange={(v) => setFormat(v as any)}
                            options={[
                                { label: 'Google format', value: 'google' },
                                { label: 'OpenAI format', value: 'openai' },
                            ]}
                            style={{ flex: 3 }}
                        />
                        <Input
                            placeholder={t('google.baseurl_placeholder', 'Base URL')}
                            value={baseURL ?? ''}
                            onChange={(e) => setBaseURL((e?.target?.value ?? '').toString())}
                            style={{ flex: 7 }}
                        />
                    </Flex>
                    <Password
                        placeholder={format === 'google' ? t('google.apikey_placeholder', 'Enter Google API Key') : 'Enter OpenAI API Key'}
                        value={apiKey ?? ''}
                        onChange={(e) => setApiKey((e?.target?.value ?? '').toString())}
                    />
                    <Input
                        placeholder={format === 'google' ? 'gemini-2.5-flash-image-preview' : 'gpt-image-1'}
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                    />
                </Flex>
            ) : null}

            <Flex gap={8} vertical>
                {hasClient && <CustomApiFormPanel />}
            </Flex>
        </Flex>
    );
}

function CustomApiFormPanel() {
    const { t } = useTranslation();
    const { format, selectedModel } = customapiStore();
    const runningTasks = customapiStore((state) => state.runningTasks);
    const form = customapiFormStore(state => state.form);
    const currentValues = customapiFormStore(state => state.currentValues);
    const schema = customapiSchemaStore(state => state.schema);
    const schemaError = customapiSchemaStore(state => state.schemaError);
    const loadingSchema = customapiSchemaStore(state => state.loadingSchema);
    const progressMessage = useTaskExecutionStore(state => state.progressMessage);
    const runError = useTaskExecutionStore(state => state.runError);

    const normalizeOpenAiInputs = useCallback((values: Record<string, any>) => {
        const nextValues = { ...values };
        ['image', 'mask'].forEach((key) => {
            const raw = nextValues[key];
            if (Array.isArray(raw)) {
                nextValues[key] = raw[0] ?? '';
            }
        });
        return nextValues;
    }, []);

    const { handleRun, handleCancel, isRunning, canCancel } = useTaskExecutor({
        selectedModel: selectedModel,
        currentValues,
        getCurrentValues: () => customapiFormStore.getState().currentValues,
        createTask,
        runningTasks,
        beforeCreateTaskHook: (values) => {
            if (format === 'openai') {
                return normalizeOpenAiInputs(values);
            }
            return values;
        },
        templateCancelable: false,
    });

    const handleRunWithSubmit = useCallback(async () => {
        if (!selectedModel) return;
        try {
            const submitResult = await form.submit();
            if (submitResult === false) {
                return;
            }
            const submittedValues =
                submitResult && typeof submitResult === 'object'
                    ? (submitResult as Record<string, any>)
                    : { ...form.values };
            form.setValues(submittedValues);
            customapiFormStore.getState().setCurrentValues(submittedValues);
            customapiStore.getState().setCurrentValues(submittedValues);
            await handleRun();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            useTaskExecutionStore.getState().setRunError(message);
        }
    }, [form, handleRun, selectedModel]);

    const translate = t as unknown as (key: string, options?: Record<string, unknown>) => string;

    const status = useMemo<WorkflowStatusDescriptor>(() => {
        if (runError) return { type: 'error', message: runError };
        if (progressMessage) return { type: 'uploading', message: progressMessage };
        if (loadingSchema) return { type: 'uploading', message: translate('google.loading', { defaultMessage: 'Loading...' }) };
        if (schemaError) return { type: 'error', message: schemaError };
        if (isRunning) return { type: 'uploading', message: translate('google.generating', { defaultMessage: 'Generating...' }) };
        return { type: 'empty' };
    }, [isRunning, loadingSchema, progressMessage, runError, schemaError, translate]);

    return (
        <>
            <SimpleWorkflowControlPanel
                headerCenter={(
                    <Flex align="center" justify="center" style={{ width: '100%', color: 'var(--sdppp-host-text-color-secondary)', fontSize: 12 }}>
                        <span style={{ fontWeight: 500, marginRight: 6 }}>{translate('google.model_label', { defaultMessage: 'Model' })}:</span>
                        <span style={{ color: 'var(--sdppp-host-text-color)', fontWeight: 600 }}>
                            {selectedModel || translate('google.model_placeholder', { defaultMessage: 'Select a model' })}
                        </span>
                    </Flex>
                )}
                runTooltip={translate('google.generate', { defaultMessage: 'Generate' })}
                runDisabled={isRunning || !selectedModel || loadingSchema || !schema || !!schemaError}
                onRun={handleRunWithSubmit}
                status={status}
            />
            <CustomApiForm />
        </>
    );
}

function CustomApiForm() {
    const { t } = useTranslation();
    const form = customapiFormStore(state => state.form);
    const schema = customapiSchemaStore(state => state.schema);
    const loadingSchema = customapiSchemaStore(state => state.loadingSchema);
    const schemaError = customapiSchemaStore(state => state.schemaError);

    if (loadingSchema) {
        return (
            <Flex align="center" justify="center" style={{ minHeight: 160 }}>
                <Spin tip={t('common.loading', { defaultValue: 'Loading...' })} />
            </Flex>
        );
    }

    if (schemaError) {
        return (
            <Alert
                message={t('common.error')}
                description={schemaError}
                type="error"
                showIcon
            />
        );
    }

    if (!schema) {
        return (
            <Alert
                message={t('taskrouter.no_schema', { defaultValue: 'Please select a model first' })}
                type="info"
                showIcon
            />
        );
    }

    return (
        <div style={{ overflow: 'auto', paddingRight: 4 }}>
            <FormProvider form={form}>
                <FormLayout layout="vertical" labelAlign="left" feedbackLayout="terse" colon={false}>
                    <SchemaField schema={schema ?? EMPTY_SCHEMA} />
                </FormLayout>
            </FormProvider>
        </div>
    );
}
