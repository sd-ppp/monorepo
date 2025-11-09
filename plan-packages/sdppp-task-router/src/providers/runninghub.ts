import type { UrlTaskHandler } from '../types';
import { SDPPPRunningHubClient } from '../clients/runninghub';

export function parseRunninghubWebappId(u: URL): string {
  return u.hostname || u.pathname.replace(/^\//, '');
}

export const runninghubHandler: UrlTaskHandler = async (url, data, ctx) => {
  const webappId = parseRunninghubWebappId(url);
  if (!webappId) {
    throw new Error('runninghub url must be runninghub://{webappId}');
  }
  const apiKey = ctx.options?.config?.apiKey || url.searchParams.get('apiKey');
  if (!apiKey) {
    throw new Error('runninghub apiKey is required');
  }
  const client = new SDPPPRunningHubClient({ apiKey });
  // Prefer direct nodeInfoList if provided to avoid UI store dependency
  const input = { ...(data || {}) };
  const task = await client.run(webappId, input, ctx.options?.signal);
  return task;
};
