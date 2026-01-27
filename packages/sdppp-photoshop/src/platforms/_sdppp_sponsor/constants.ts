import { loadRemoteConfig } from '@sdppp/vite-remote-config-loader';

type SDPPPSponsorRemoteConfig = {
  taskrouterBaseUrl?: string | null;  // 远程配置字段名保持和 chongchong 一致
  supabaseUrl?: string | null;
  supabaseAnonKey?: string | null;
  rechargeUrl?: string | null;
};

const sdpppSponsorRemoteConfig: SDPPPSponsorRemoteConfig | null = (() => {
  try {
    return loadRemoteConfig<SDPPPSponsorRemoteConfig>('sdppp_sponsor');
  } catch (error) {
    console.error('[sdppp_sponsor] failed to load remote config', error);
    return null;
  }
})();

const normalizeConfigValue = (value?: string | null): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const SDPPP_SPONSOR_BASE_URL = normalizeConfigValue(
  sdpppSponsorRemoteConfig?.taskrouterBaseUrl  // 使用远程配置的字段名
);

export const SUPABASE_URL = normalizeConfigValue(
  sdpppSponsorRemoteConfig?.supabaseUrl
);

export const SUPABASE_ANON_KEY = normalizeConfigValue(
  sdpppSponsorRemoteConfig?.supabaseAnonKey
);

export const SUPABASE_FUNCTION_NAME = 'authing-bridge3';

export const SDPPP_SPONSOR_RECHARGE_URL = normalizeConfigValue(
  sdpppSponsorRemoteConfig?.rechargeUrl
);

export function resolveTenantId(): string | null {
  try {
    const tenant = loadRemoteConfig('tenant') as { id?: string | null } | null;
    if (!tenant || !tenant.id) return null;
    return tenant.id;
  } catch (error) {
    console.warn('[sdppp_sponsor] failed to resolve tenant config', error);
    return null;
  }
}
