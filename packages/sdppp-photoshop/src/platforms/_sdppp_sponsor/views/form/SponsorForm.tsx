import { memo } from 'react';
import { Alert, Flex, Spin } from 'antd';
import { createSchemaField, FormProvider } from '@formily/react';
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
import { SdpppWidgetUploadSelectorRouter, SdpppWidgetDeferredUploadSelector } from '@sdppp/formily-widgets';
import type { UseBoundStore, StoreApi } from 'zustand';
import type { SponsorFormState } from './formStore';
import type { SponsorSchemaState } from '../schema/schemaStore';

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
    Select: FormilySelect,
    Switch,
    ArrayItems,
    'Input.TextArea': FormilyInput.TextArea,
    FormLayout,
    UploadSelector: SdpppWidgetUploadSelectorRouter,
    DeferredUploadSelector: SdpppWidgetDeferredUploadSelector,
  },
});

const EMPTY_SCHEMA: ISchema = { type: 'object', properties: {} };

export type SponsorFormProps = {
  t: (key: string, options?: any) => string;
  formStore: UseBoundStore<StoreApi<SponsorFormState>>;
  schemaStore: UseBoundStore<StoreApi<SponsorSchemaState>>;
};

const SponsorForm = memo(function SponsorForm({ t, formStore, schemaStore }: SponsorFormProps) {
  const form = formStore(state => state.form);
  const schema = schemaStore(state => state.schema);
  const loadingSchema = schemaStore(state => state.loadingSchema);

  const formSchema = schema ?? EMPTY_SCHEMA;
  const hasSchema = !!schema;

  if (loadingSchema) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: 160 }}>
        <Spin tip={t('common.loading', { defaultValue: 'Loading...' })} />
      </Flex>
    );
  }

  if (!hasSchema) {
    return (
      <Alert
        message={t('taskrouter.no_schema', { defaultValue: 'Please select an app first' })}
        type="info"
        showIcon
      />
    );
  }

  return (
    <div style={{ overflow: 'auto', paddingRight: 4 }}>
      <FormProvider form={form}>
        <FormLayout layout="vertical" labelAlign="left" feedbackLayout="terse" colon={false}>
          <SchemaField schema={formSchema} />
        </FormLayout>
      </FormProvider>
    </div>
  );
});

export default SponsorForm;
