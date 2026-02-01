import {
  createSDPPPXServices,
  registerSDPPPXProvider,
  type HeadersResolver,
  type SDPPPXServices,
} from '@sdppp/sdpppx-services';

export type TaskrouterServicesOptions = {
  baseUrl: string;
  headers: HeadersResolver;
  supabase: { getClient: (tenantId?: string | null) => Promise<any> };
};

export const createTaskrouterServices = (options: TaskrouterServicesOptions): SDPPPXServices => {
  const services = createSDPPPXServices({
    baseUrl: options.baseUrl,
    headers: options.headers,
    supabase: options.supabase,
  });
  registerSDPPPXProvider({ services, scheme: 'sdpppx' });
  return services;
};
