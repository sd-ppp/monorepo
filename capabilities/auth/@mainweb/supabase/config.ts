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

const TENANT_ID = '65b95867-1c57-42ed-baa5-849a89790b51';

const normalize = (value?: string | null): string => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

export const SUPABASE_CONFIG = {
  url: normalize(sponsorConfig?.supabaseUrl),
  anonKey: normalize(sponsorConfig?.supabaseAnonKey),
  tenantId: TENANT_ID,
  bridgeFunctionName: 'authing-bridge3',
  bridgeRegion: 'ap-southeast-1',
} as const;
