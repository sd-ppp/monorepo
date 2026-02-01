import type { SDPPPSponsor } from '../../client';
import type { FormilySchema } from '../../schemaUtils';

export type SchemaResponse = {
  schema: FormilySchema | null;
  values: Record<string, any>;
  metadata: Record<string, any> | null;
  recommendedUploadProvider: string | null;
  cancelable: boolean | null;
};

export const fetchSchema = async (client: SDPPPSponsor, templateId: string): Promise<SchemaResponse> => {
  const result = await client.getNodes(templateId);
  const schema = result.rawData.schema ?? null;
  const values = result.rawData.values ?? {};
  const metadata = result.rawData.metadata ?? null;
  const recommendedUploadProvider =
    typeof result.rawData.recommendedUploadProvider === 'string'
      ? result.rawData.recommendedUploadProvider
      : null;
  const cancelable =
    typeof result.rawData.cancelable === 'boolean'
      ? result.rawData.cancelable
      : null;

  return {
    schema,
    values,
    metadata,
    recommendedUploadProvider,
    cancelable,
  };
};
