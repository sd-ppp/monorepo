export const resolveLayer = async ({ uri }: { uri: string; type: 'content' | 'mask' }) => {
  if (uri.includes('layerId=')) return { uri };
  const glue = uri.includes('?') ? '&' : '?';
  return { uri: `${uri}${glue}layerId=mock-layer` };
};
