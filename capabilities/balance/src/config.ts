import { loadRemoteConfig } from '@sdppp/vite-remote-config-loader';

type SDPPPSponsorRemoteConfig = {
  rechargeUrl?: string | null;
};

const sdpppSponsorRemoteConfig: SDPPPSponsorRemoteConfig | null = (() => {
  try {
    return loadRemoteConfig<SDPPPSponsorRemoteConfig>('sdppp_sponsor');
  } catch (error) {
    console.error('[balance] failed to load sdppp_sponsor config', error);
    return null;
  }
})();

const normalizeConfigValue = (value?: string | null): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const SDPPP_SPONSOR_RECHARGE_URL = normalizeConfigValue(
  sdpppSponsorRemoteConfig?.rechargeUrl
);
