import type { Meta, StoryObj } from '@storybook/react';
import { useMemo } from 'react';
import { sponsorAuthStore } from '../auth/authStore';
import { sponsorExecutionStore } from '../form/executionStore';
import { sponsorFormStore } from '../form/formStore';
import SponsorEditor from '../form/SponsorEditor';
import { sponsorHistoryStore } from '../history/historyStore';
import SponsorHistory from '../history/SponsorHistory';
import { sponsorSchemaStore } from '../schema/schemaStore';
import SponsorBalance from '../balance/SponsorBalance';
import SponsorPage from '../SponsorPage';
import { sponsorTemplateStore } from '../templates/templateStore';
import SponsorHeader from '../ui/SponsorHeader';
import SponsorTabs from '../ui/SponsorTabs';
import { sponsorUiStore } from '../uiStore';
import { mockBalanceStore, useMockStores } from './mockStores';

const meta: Meta<typeof SponsorPage> = {
  title: 'SDPPP Sponsor/SponsorPage',
  component: SponsorPage,
};

export default meta;

type Story = StoryObj<typeof SponsorPage>;

const Template = () => {
  const overrides = useMemo(() => ({}), []);
  useMockStores(overrides);

  const t = (key: string, options?: any) => options?.defaultValue ?? key;

  const header = (
    <SponsorHeader
      t={t}
      authStore={sponsorAuthStore}
      templateStore={sponsorTemplateStore}
      onRefreshTemplates={() => {}}
      onTemplateSelect={() => {}}
    />
  );

  const editor = (
    <SponsorEditor
      t={t}
      executionStore={sponsorExecutionStore}
      schemaStore={sponsorSchemaStore}
      templateStore={sponsorTemplateStore}
      authStore={sponsorAuthStore}
      formStore={sponsorFormStore}
      onRun={() => {}}
      onCancel={() => {}}
      isRunning={false}
      canCancel={false}
    />
  );

  const balance = (
    <SponsorBalance
      t={t}
      balanceStore={mockBalanceStore}
      uiStore={sponsorUiStore}
      rechargeUrl="https://example.com/recharge"
      onOpenRecharge={() => {}}
      onRefreshBalance={() => {}}
    />
  );

  const history = (
    <SponsorHistory
      t={t}
      historyStore={sponsorHistoryStore}
      authStore={sponsorAuthStore}
      active={false}
      onSelect={() => {}}
      onRefresh={() => {}}
      onDetailRefresh={() => {}}
      onSendImage={() => {}}
      sendingUrl={null}
      resolveTemplateLabel={(item) => item.templateName ?? item.templateId}
    />
  );

  const tabs = (
    <SponsorTabs
      t={t}
      uiStore={sponsorUiStore}
      onTabChange={() => {}}
      editor={editor}
      history={history}
      rightContent={balance}
    />
  );

  return (
    <SponsorPage
      t={t}
      isLogin
      authStore={sponsorAuthStore}
      uiStore={sponsorUiStore}
      header={header}
      tabs={tabs}
    />
  );
};

export const Default: Story = {
  render: () => <Template />,
};
