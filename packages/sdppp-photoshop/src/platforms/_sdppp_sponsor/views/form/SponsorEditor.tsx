import { Flex } from 'antd';
import { memo } from 'react';
import type { StoreApi, UseBoundStore } from 'zustand';
import type { SponsorAuthState } from '../auth/authStore';
import type { SponsorSchemaState } from '../schema/schemaStore';
import type { SponsorTemplateState } from '../templates/templateStore';
import SponsorForm from './SponsorForm';
import SponsorStatus from './SponsorStatus';
import type { SponsorExecutionState } from './executionStore';
import type { SponsorFormState } from './formStore';

export type SponsorEditorProps = {
  t: (key: string, options?: any) => string;
  executionStore: UseBoundStore<StoreApi<SponsorExecutionState>>;
  schemaStore: UseBoundStore<StoreApi<SponsorSchemaState>>;
  templateStore: UseBoundStore<StoreApi<SponsorTemplateState>>;
  authStore: UseBoundStore<StoreApi<SponsorAuthState>>;
  formStore: UseBoundStore<StoreApi<SponsorFormState>>;
  onRun: () => Promise<void> | void;
  onCancel: () => Promise<void> | void;
  isRunning: boolean;
  canCancel: boolean;
};

const SponsorEditor = memo(function SponsorEditor({
  t,
  executionStore,
  schemaStore,
  templateStore,
  authStore,
  formStore,
  onRun,
  onCancel,
  isRunning,
  canCancel,
}: SponsorEditorProps) {
  return (
    <Flex vertical gap={12}>
      <SponsorStatus
        t={t}
        executionStore={executionStore}
        schemaStore={schemaStore}
        templateStore={templateStore}
        authStore={authStore}
        onRun={onRun}
        onCancel={onCancel}
        isRunning={isRunning}
        canCancel={canCancel}
      />
      <SponsorForm t={t} formStore={formStore} schemaStore={schemaStore} />
    </Flex>
  );
});

export default SponsorEditor;
