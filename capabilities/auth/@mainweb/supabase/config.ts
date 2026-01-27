import { loadRemoteConfig } from '@sdppp/vite-remote-config-loader';

type SponsorRemoteConfig = {
  supabaseUrl?: string | null;
  supabaseAnonKey?: string | null;
};

const sponsorConfig: SponsorRemoteConfig | null = (() => {
  try {
    return loadRemoteConfig<SponsorRemoteConfig>('sdppp_sponsor');
  } catch (error) {
    console.error('[auth] failed to load sdppp_sponsor config', error);
    return null;
  }
})();

const tenantConfig: { id?: string | null } | null = (() => {
  try {
    return loadRemoteConfig('tenant') as { id?: string | null } | null;
  } catch (error) {
    console.error('[auth] failed to load tenant config', error);
    return null;
  }
})();

const normalize = (value?: string | null): string => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

export const SUPABASE_CONFIG = {
  url: normalize(sponsorConfig?.supabaseUrl),
  anonKey: normalize(sponsorConfig?.supabaseAnonKey),
  tenantId: normalize(tenantConfig?.id),
  bridgeFunctionName: 'authing-bridge3',
  bridgeRegion: 'ap-southeast-1',
} as const;
