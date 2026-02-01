import { Alert, Flex, Select } from 'antd';
import { memo, useMemo } from 'react';
import type { StoreApi, UseBoundStore } from 'zustand';
import type { SponsorAuthState } from '../auth/authStore';
import type { SponsorTemplateState } from '../templates/templateStore';

export type SponsorHeaderProps = {
  t: (key: string, options?: any) => string;
  authStore: UseBoundStore<StoreApi<SponsorAuthState>>;
  templateStore: UseBoundStore<StoreApi<SponsorTemplateState>>;
  onRefreshTemplates: () => Promise<void> | void;
  onTemplateSelect: (value: string) => void;
};

const SponsorHeader = memo(function SponsorHeader({
  t,
  authStore,
  templateStore,
  onRefreshTemplates,
  onTemplateSelect,
}: SponsorHeaderProps) {
  const authError = authStore(state => state.authError);
  const authLoading = authStore(state => state.authLoading);
  const templates = templateStore(state => state.templates);
  const loadingTemplates = templateStore(state => state.loadingTemplates);
  const selectedTemplateId = templateStore(state => state.selectedTemplateId);

  const templatesOptions = useMemo(
    () => templates.map(item => ({ value: item.value, label: item.label })),
    [templates]
  );

  return (
    <Flex vertical gap={8}>
      {authError ? <Alert type="error" showIcon message={authError} /> : null}
      <Flex gap={8} align="center">
        <Select
          style={{ flex: 1 }}
          placeholder={t('taskrouter.template_placeholder', { defaultValue: 'Select Banana app...' })}
          loading={loadingTemplates}
          onDropdownVisibleChange={(open) => {
            if (open && !loadingTemplates) {
              void onRefreshTemplates();
            }
          }}
          onChange={(value) => {
            if (typeof value === 'string' && value) {
              onTemplateSelect(value);
            }
          }}
          options={templatesOptions}
          value={selectedTemplateId || undefined}
          disabled={authLoading || !!authError}
        />
      </Flex>
    </Flex>
  );
});

export default SponsorHeader;
