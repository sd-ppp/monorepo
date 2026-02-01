import { describe, expect, it, beforeEach } from 'vitest';
import { sponsorSchemaStore } from './schemaStore';

describe('sponsorSchemaStore', () => {
  beforeEach(() => {
    sponsorSchemaStore.getState().resetSchema();
  });

  it('updates schema and error', () => {
    sponsorSchemaStore.getState().setSchema({ type: 'object', properties: {} } as any);
    sponsorSchemaStore.getState().setSchemaError('bad schema');
    sponsorSchemaStore.getState().setLoadingSchema(true);

    const state = sponsorSchemaStore.getState();
    expect(state.schema).toBeTruthy();
    expect(state.schemaError).toBe('bad schema');
    expect(state.loadingSchema).toBe(true);
  });
});
