import { register } from '../registry';
import type { UrlTaskHandler } from '../types';
import { runninghubHandler } from './runninghub';
import { replicateHandler } from './replicate';
import { customapiHandler } from './customapi';
import { comfyHandler } from './comfy';

export function registerDefaultHandlers() {
  register('runninghub', runninghubHandler as UrlTaskHandler);
  register('replicate', replicateHandler as UrlTaskHandler);
  register('customapi', customapiHandler as UrlTaskHandler);
  // Comfy is optional or placeholder depending on availability
  register('comfy', comfyHandler as UrlTaskHandler);
}
