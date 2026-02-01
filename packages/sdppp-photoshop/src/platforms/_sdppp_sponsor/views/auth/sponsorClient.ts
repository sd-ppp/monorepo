import type { HeadersResolver, SDPPPXServices } from '@sdppp/sdpppx-services';
import { SDPPPSponsor } from '../../client';

export type SponsorClientOptions = {
  baseUrl: string;
  headers: HeadersResolver;
  services: SDPPPXServices;
  getTenantId: () => string | null;
};

export const createSponsorClient = (options: SponsorClientOptions) => {
  return new SDPPPSponsor({
    baseUrl: options.baseUrl,
    headers: options.headers,
    services: options.services,
    getTenantId: options.getTenantId,
  });
};
