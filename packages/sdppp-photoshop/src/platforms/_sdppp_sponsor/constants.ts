import { loadRemoteConfig } from '@sdppp/vite-remote-config-loader';
import { SUPABASE_CONFIG } from '../../../../../capabilities/auth/@mainweb/supabase/config';

type SDPPPSponsorRemoteConfig = {
  taskrouterBaseUrl?: string | null;  // 远程配置字段名保持和 chongchong 一致
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
  // 'https://sdpppx.zombee.tech/ppserver-test'
);

export const SDPPP_SPONSOR_RECHARGE_URL = normalizeConfigValue(
  sdpppSponsorRemoteConfig?.rechargeUrl
);

export const SUPABASE_URL = normalizeConfigValue(
  SUPABASE_CONFIG.url
);

export const SUPABASE_ANON_KEY = normalizeConfigValue(
  SUPABASE_CONFIG.anonKey
);

export const SUPABASE_FUNCTION_NAME = SUPABASE_CONFIG.bridgeFunctionName;

export function resolveTenantId(): string | null {
  return normalizeConfigValue(SUPABASE_CONFIG.tenantId);
}
