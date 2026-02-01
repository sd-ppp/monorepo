import { sdpppSDK, useTranslation } from '@sdppp/common';
import { useCallback, useEffect, useMemo } from 'react';
import { useStore } from 'zustand';
import { SDPPP_SPONSOR_RECHARGE_URL } from '../constants';
import { sponsorAuthStore } from './auth/authStore';
import { useSponsorAuth } from './auth/useSponsorAuth';
import SponsorBalance from './balance/SponsorBalance';
import { useBalance } from './balance/useBalance';
import { sponsorExecutionStore } from './form/executionStore';
import { sponsorFormStore } from './form/formStore';
import SponsorEditor from './form/SponsorEditor';
import { useAutoTemplateSelection } from './form/useAutoTemplateSelection';
import { useExecution } from './form/useExecution';
import { sponsorHistoryStore } from './history/historyStore';
import SponsorHistory from './history/SponsorHistory';
import { useHistory } from './history/useHistory';
import { sponsorSchemaStore } from './schema/schemaStore';
import { useSchemaForm } from './schema/useSchemaForm';
import SponsorPage from './SponsorPage';
import { sponsorTemplateStore } from './templates/templateStore';
import { useTemplates } from './templates/useTemplates';
import SponsorHeader from './ui/SponsorHeader';
import SponsorTabs from './ui/SponsorTabs';
import { sponsorUiStore } from './uiStore';
import { useSponsorTabs } from './useSponsorTabs';

export default function SponsorPageContainer() {
  const { t } = useTranslation();
  const isLogin = useStore(sdpppSDK.stores.WebviewStore, (state: any) => state.isLogin);
  const hasClient = sponsorAuthStore(state => !!state.client);

  useSponsorAuth();

  if (!hasClient) {
    return (
      <SponsorPage
        t={t}
        hasClient={false}
        authStore={sponsorAuthStore}
        uiStore={sponsorUiStore}
        header={<></>}
        tabs={<></>}
      />
    );
  }

  return <SponsorPageContent t={t} isLogin={isLogin} />;
}

function SponsorPageContent({ t, isLogin }: { t: (key: string, options?: any) => string; isLogin: boolean }) {
  const { refreshTemplates } = useTemplates();
  const { loadSchema } = useSchemaForm();
  const { refreshBalance } = useBalance();

  const { handleRunWithSubmit, handleCancel, isRunning, canCancel } = useExecution({
    onRunFinished: refreshBalance,
  });

  const { handleTemplateSelect } = useAutoTemplateSelection(loadSchema);
  const { handleTabChange } = useSponsorTabs();

  const activeTab = sponsorUiStore(state => state.activeTab);
  const supabaseSession = sponsorAuthStore(state => state.supabaseSession);
  const templates = sponsorTemplateStore(state => state.templates);
  const loadingTemplates = sponsorTemplateStore(state => state.loadingTemplates);
  const hasFetchedBalance = sponsorUiStore(state => state.hasFetchedBalance);
  const loadingBalance = sponsorUiStore(state => state.balanceLoading);
  const authLoading = sponsorAuthStore(state => state.authLoading);
  const { refreshHistory, handleSelect, handleDetailRefresh, handleSendImage, sendingUrl } = useHistory({
    active: activeTab === 'history',
    t,
  });

  useEffect(() => {
    if (!isLogin) return;
    if (!supabaseSession) return;
    if (loadingTemplates) return;
    if (templates.length > 0) return;
    void refreshTemplates();
  }, [isLogin, supabaseSession, loadingTemplates, templates.length, refreshTemplates]);

  useEffect(() => {
    if (!isLogin) return;
    if (!supabaseSession) return;
    if (authLoading) return;
    if (hasFetchedBalance) return;
    if (loadingBalance) return;
    void refreshBalance();
  }, [authLoading, hasFetchedBalance, isLogin, loadingBalance, refreshBalance, supabaseSession]);

  const handleOpenRecharge = useCallback(() => {
    const rechargeUrl = SDPPP_SPONSOR_RECHARGE_URL;
    if (!rechargeUrl) return;
    try {
      sdpppSDK.plugins.photoshop.openExternalLink({ url: rechargeUrl });
    } catch (error) {
      console.error('[sdppp_sponsor] failed to open recharge url', error);
    }
  }, []);

  const resolveTemplateLabel = useCallback(
    (item: { templateId: string; templateName?: string | null }) => {
      if (item.templateName) return item.templateName;
      const templates = sponsorTemplateStore.getState().templates;
      const map = new Map<string, string>();
      templates.forEach((entry) => {
        if (!entry) return;
        const label = entry.label ?? entry.value ?? entry.templateId;
        if (entry.value) map.set(entry.value, label);
        if (entry.templateId) map.set(entry.templateId, label);
      });
      return map.get(item.templateId) ?? item.templateId;
    },
    []
  );

  const editor = useMemo(
    () => (
      <SponsorEditor
        t={t}
        executionStore={sponsorExecutionStore}
        schemaStore={sponsorSchemaStore}
        templateStore={sponsorTemplateStore}
        authStore={sponsorAuthStore}
        formStore={sponsorFormStore}
        onRun={handleRunWithSubmit}
        onCancel={handleCancel}
        isRunning={isRunning}
        canCancel={canCancel}
      />
    ),
    [
      t,
      handleRunWithSubmit,
      handleCancel,
      isRunning,
      canCancel,
    ]
  );

  const balance = useMemo(
    () => (
      <SponsorBalance
        t={t}
        balanceStore={sdpppSDK.stores.WebviewStore}
        uiStore={sponsorUiStore}
        rechargeUrl={SDPPP_SPONSOR_RECHARGE_URL}
        onOpenRecharge={handleOpenRecharge}
        onRefreshBalance={refreshBalance}
      />
    ),
    [t, handleOpenRecharge, refreshBalance, sponsorUiStore]
  );

  const history = useMemo(
    () => (
      <SponsorHistory
        t={t}
        historyStore={sponsorHistoryStore}
        authStore={sponsorAuthStore}
        active={activeTab === 'history'}
        onSelect={handleSelect}
        onRefresh={refreshHistory}
        onDetailRefresh={handleDetailRefresh}
        onSendImage={handleSendImage}
        sendingUrl={sendingUrl}
        resolveTemplateLabel={resolveTemplateLabel}
      />
    ),
    [t, activeTab, handleDetailRefresh, handleSelect, refreshHistory, resolveTemplateLabel, handleSendImage, sendingUrl]
  );

  const header = useMemo(
    () => (
      <SponsorHeader
        t={t}
        authStore={sponsorAuthStore}
        templateStore={sponsorTemplateStore}
        onRefreshTemplates={refreshTemplates}
        onTemplateSelect={handleTemplateSelect}
      />
    ),
    [t, refreshTemplates, handleTemplateSelect]
  );

  const tabs = useMemo(
    () => (
      <SponsorTabs
        t={t}
        uiStore={sponsorUiStore}
        onTabChange={handleTabChange}
        editor={editor}
        history={history}
        rightContent={balance}
      />
    ),
    [t, handleTabChange, editor, history, balance]
  );

  return (
    <SponsorPage
      t={t}
      hasClient={true}
      authStore={sponsorAuthStore}
      uiStore={sponsorUiStore}
      header={header}
      tabs={tabs}
    />
  );
}
