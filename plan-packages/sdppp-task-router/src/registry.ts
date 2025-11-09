import type { UrlTaskHandler } from './types';

const handlers = new Map<string, UrlTaskHandler>();

export function register(scheme: string, handler: UrlTaskHandler) {
  handlers.set(normalizeScheme(scheme), handler);
}

export function getHandler(scheme: string): UrlTaskHandler | undefined {
  return handlers.get(normalizeScheme(scheme));
}

function normalizeScheme(s: string) {
  return s.replace(/:\s*$/, '').toLowerCase();
}

export function clearHandlers() {
  handlers.clear();
}

