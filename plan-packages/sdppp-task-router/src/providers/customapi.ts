import type { UrlTaskHandler } from '../types';
import { SDPPPCustomApiClient } from '../clients/customapi';

export function parseCustomApiFormat(url: URL): 'google' | 'openai' {
  const format = (url.hostname || '').toLowerCase();
  if (format !== 'google' && format !== 'openai') {
    throw new Error('customapi url must be customapi://google or customapi://openai');
  }
  return format;
}

export const customapiHandler: UrlTaskHandler = async (url, data, ctx) => {
  const apiKey = ctx.options?.config?.apiKey || url.searchParams.get('apiKey');
  const baseURL = ctx.options?.config?.baseURL || url.searchParams.get('baseURL') || '';
  if (!apiKey) {
    throw new Error('customapi apiKey is required');
  }
  const format = parseCustomApiFormat(url);
  const client = new SDPPPCustomApiClient({ apiKey, baseURL, format });
  const model = (data && typeof data.model === 'string' && data.model) || format;
  const task = await client.run(model, data || {}, ctx.options?.signal);
  return task;
};
