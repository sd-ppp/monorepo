import type { UrlTaskHandler } from '../types';
import { SDPPPReplicateClient } from '../clients/replicate';

export function parseModel(url: URL): string {
  // replicate://{owner}/{model}
  const owner = url.hostname;
  const model = url.pathname.replace(/^\//, '');
  if (!owner || !model) {
    throw new Error('replicate url must be replicate://{owner}/{model}');
  }
  return `${owner}/${model}`;
}

export const replicateHandler: UrlTaskHandler = async (url, data, ctx) => {
  const apiKey = ctx.options?.config?.apiKey || url.searchParams.get('apiKey');
  if (!apiKey) {
    throw new Error('replicate apiKey is required');
  }
  const client = new SDPPPReplicateClient({ apiKey });
  const model = parseModel(url);
  const task = await client.run(model, data || {}, ctx.options?.signal);
  return task;
};
